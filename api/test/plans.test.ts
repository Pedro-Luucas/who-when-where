import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import { openDatabase } from "../src/db.ts";
import { FEATURES, LIMITS, UNLIMITED_PRACTICE_GAMES, planOf } from "../src/plans.ts";
import { RateLimiter } from "../src/rate-limit.ts";
import { SESSION_COOKIE } from "../src/sessions.ts";

// The site's plan table: the API keeps a copy (src/plans.ts), and the two must match.
const site = (await import(new URL("../../shared/plans.ts", import.meta.url).href)) as {
  FEATURES: readonly string[];
  LIMITS: unknown;
  UNLIMITED_PRACTICE_GAMES: readonly string[];
};

const SETTINGS = {
  rounds: { "who-when-where": 1, wayfarer: 1 },
  order: "grouped",
  timeLimit: 0,
  digs: 5,
  guesses: 6,
  attempts: 3,
  pace: "free",
};

function world(proGating: boolean) {
  const config: Config = {
    host: "127.0.0.1",
    port: 0,
    databasePath: ":memory:",
    secureCookies: false,
    trustProxy: false,
    proGating,
  };
  const db = openDatabase(":memory:");
  const app = createApp(db, config, new RateLimiter(), { publicKey: null, async toUser() {} });

  function browser() {
    let cookie = "";
    return async function call(method: string, path: string, body?: unknown) {
      const response = await app.request(path, {
        method,
        headers: {
          ...(method === "GET" ? {} : { "content-type": "application/json" }),
          ...(cookie ? { cookie } : {}),
        },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      });
      for (const header of response.headers.getSetCookie()) {
        const [pair] = header.split(";");
        if (pair.startsWith(`${SESSION_COOKIE}=`)) cookie = pair === `${SESSION_COOKIE}=` ? "" : pair;
      }
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    };
  }

  async function player(username: string) {
    const call = browser();
    const created = await call("POST", "/auth/signup", {
      email: `${username}@example.com`,
      password: "a-long-password",
      username,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return { call, id: created.body.user.id as string, username, signup: created.body };
  }

  const makePro = (id: string, expiresAt: number | null = null) =>
    db.prepare("UPDATE users SET plan = 'pro', plan_expires_at = ? WHERE id = ?").run(expiresAt, id);

  return { db, player, makePro };
}

test("plans: the API's copy matches the site's shared/plans.ts", () => {
  assert.deepEqual([...FEATURES], [...site.FEATURES]);
  assert.deepEqual(LIMITS, site.LIMITS);
  assert.deepEqual([...UNLIMITED_PRACTICE_GAMES], [...site.UNLIMITED_PRACTICE_GAMES]);
});

test("plans: Pro lasts until it expires", () => {
  const now = Date.now();
  assert.equal(planOf({ plan: "free", plan_expires_at: null }, now), "free");
  assert.equal(planOf({ plan: "pro", plan_expires_at: null }, now), "pro");
  assert.equal(planOf({ plan: "pro", plan_expires_at: now + 1000 }, now), "pro");
  assert.equal(planOf({ plan: "pro", plan_expires_at: now - 1 }, now), "free");
});

test("entitlements: /me, sign-up and log-in say what the plan allows", async () => {
  const { player, makePro } = world(false);
  const ada = await player("ada");
  assert.equal(ada.signup.entitlements.plan, "free");
  assert.deepEqual(ada.signup.entitlements.features, []);
  assert.deepEqual(ada.signup.entitlements.limits, LIMITS.free);
  assert.equal(ada.signup.entitlements.gating, false);

  makePro(ada.id);
  const me = await ada.call("GET", "/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, "ada");
  assert.equal(me.body.entitlements.plan, "pro");
  assert.equal(me.body.entitlements.planExpiresAt, null);
  assert.deepEqual([...me.body.entitlements.features].sort(), [...FEATURES].sort());
  assert.deepEqual(me.body.entitlements.limits, LIMITS.pro);

  const login = await ada.call("POST", "/auth/login", { email: "ada@example.com", password: "a-long-password" });
  assert.equal(login.body.entitlements.plan, "pro");
});

test("entitlements: a single feature can be granted, and grants expire", async () => {
  const { db, player } = world(true);
  const ada = await player("ada");
  db.prepare("INSERT INTO entitlement_grants (user_id, feature, expires_at, reason) VALUES (?, ?, NULL, 'test')").run(
    ada.id,
    "archive.all",
  );
  db.prepare("INSERT INTO entitlement_grants (user_id, feature, expires_at, reason) VALUES (?, ?, ?, 'test')").run(
    ada.id,
    "stats.deep",
    Date.now() - 1,
  );
  const me = await ada.call("GET", "/me");
  assert.equal(me.body.entitlements.plan, "free");
  assert.deepEqual(me.body.entitlements.features, ["archive.all"]);
  assert.equal(me.body.entitlements.gating, true);
});

test("practice: gating off counts puzzles but never refuses", async () => {
  const { player } = world(false);
  const ada = await player("ada");
  for (let i = 0; i < 12; i++) {
    const ticket = await ada.call("POST", "/practice/start", { game: "same-year" });
    assert.equal(ticket.status, 200);
    assert.equal(ticket.body.metered, true);
    assert.equal(ticket.body.limit, null);
  }
  assert.equal((await ada.call("GET", "/me")).body.entitlements.usageToday.practice, 12);
  // The classics never count.
  const classic = await ada.call("POST", "/practice/start", { game: "wayfarer" });
  assert.equal(classic.body.metered, false);
  assert.equal((await ada.call("POST", "/practice/start", { game: "chess" })).status, 400);
});

test("practice: gating on gives a free account its allowance, then 402", async () => {
  const { player, makePro } = world(true);
  const ada = await player("ada");
  const allowance = LIMITS.free.practicePerDay!;
  for (let i = 1; i <= allowance; i++) {
    const ticket = await ada.call("POST", "/practice/start", { game: "flag-peek" });
    assert.equal(ticket.status, 200);
    assert.equal(ticket.body.remaining, allowance - i);
  }
  const refused = await ada.call("POST", "/practice/start", { game: "flag-peek" });
  assert.equal(refused.status, 402);
  assert.deepEqual(refused.body, { error: "upgrade_required", feature: "practice.unlimited" });
  // The classics stay open.
  assert.equal((await ada.call("POST", "/practice/start", { game: "outline" })).status, 200);

  // Pro has no allowance; an expired Pro is Free again.
  makePro(ada.id);
  const pro = await ada.call("POST", "/practice/start", { game: "flag-peek" });
  assert.equal(pro.status, 200);
  assert.equal(pro.body.remaining, null);
  makePro(ada.id, Date.now() - 1);
  assert.equal((await ada.call("POST", "/practice/start", { game: "flag-peek" })).status, 402);
});

test("parties: seats come from the host's plan when gating is on", async () => {
  // Off: 12 seats for everyone, as before plans.
  {
    const { player } = world(false);
    const host = await player("host");
    const room = await host.call("POST", "/parties", { settings: SETTINGS });
    assert.equal(room.status, 201);
    assert.equal(room.body.party.seats, 12);
  }

  const { player, makePro } = world(true);
  const host = await player("host");
  const room = await host.call("POST", "/parties", { settings: SETTINGS });
  assert.equal(room.body.party.seats, LIMITS.free.partySeats);
  const code = room.body.party.code as string;

  const guests = [];
  for (let i = 1; i < LIMITS.free.partySeats; i++) {
    const guest = await player(`guest${i}`);
    assert.equal((await guest.call("POST", "/parties/join", { code })).status, 200);
    guests.push(guest);
  }
  const late = await player("late");
  assert.equal((await late.call("POST", "/parties/join", { code })).status, 409);

  // A Pro host's room has 16.
  makePro(host.id);
  const joined = await late.call("POST", "/parties/join", { code });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.party.seats, LIMITS.pro.partySeats);
});
