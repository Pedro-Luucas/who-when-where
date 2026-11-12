import assert from "node:assert/strict";
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import { currentWeek, utcDay, weekDays, weekEndsAt, weekOfDay } from "../src/days.ts";
import { openDatabase } from "../src/db.ts";
import { GROUP_SIZE, joinLeague, zonesOf } from "../src/leagues.ts";
import { createPusher, encryptPayload, isPushEndpoint, newVapidKeys, vapidToken, type PushMessage, type Pusher, type Send } from "../src/push.ts";
import { remindStreaks } from "../src/reminders.ts";
import { RateLimiter } from "../src/rate-limit.ts";
import { SESSION_COOKIE } from "../src/sessions.ts";

const config: Config = {
  host: "127.0.0.1",
  port: 0,
  databasePath: ":memory:",
  secureCookies: false,
  trustProxy: false,
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
const RESULTS = [
  { points: 800, detail: "" },
  { points: 600, detail: "3/6" },
];

/** A pusher that records what it would have sent. */
function fakePusher(): Pusher & { sent: { userId: string; message: PushMessage }[] } {
  const sent: { userId: string; message: PushMessage }[] = [];
  return {
    publicKey: "test-key",
    sent,
    async toUser(userId, message) {
      sent.push({ userId, message });
    },
  };
}

function world(pusher: Pusher = fakePusher()) {
  const db = openDatabase(":memory:");
  const app = createApp(db, config, new RateLimiter(), pusher);

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

  async function player(username: string, extra: Record<string, unknown> = {}) {
    const call = browser();
    const created = await call("POST", "/auth/signup", {
      email: `${username}@example.com`,
      password: "a-long-password",
      username,
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return { call, id: created.body.user.id as string, username };
  }

  async function befriend(a: Awaited<ReturnType<typeof player>>, b: Awaited<ReturnType<typeof player>>) {
    assert.equal((await a.call("POST", "/friends", { username: b.username })).status, 201);
    assert.equal((await b.call("POST", `/friends/${a.id}/accept`)).status, 200);
  }

  return { db, app, browser, player, befriend, pusher };
}

test("weeks run Monday to Sunday in UTC", () => {
  assert.equal(weekOfDay(1), 1); // Tue 10 Nov 2026
  assert.equal(weekOfDay(6), 1); // Sun 15 Nov
  assert.equal(weekOfDay(7), 2); // Mon 16 Nov
  assert.deepEqual(weekDays(1), { first: 1, last: 6 });
  assert.deepEqual(weekDays(2), { first: 7, last: 13 });
  assert.equal(new Date(weekEndsAt(1)).toISOString(), "2026-11-16T00:00:00.000Z");
  assert.equal(currentWeek(Date.parse("2026-11-22T23:59:00Z")), 2);
  assert.equal(currentWeek(Date.parse("2026-11-23T00:00:00Z")), 3);
});

test("profiles: privacy, hidden presence and country", async () => {
  const { player, browser, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const visitor = browser();

  const settings = await ada.call("PATCH", "/me", { profileVisibility: "friends", hidePresence: true, country: "br" });
  assert.equal(settings.status, 200);
  assert.equal(settings.body.user.profileVisibility, "friends");
  assert.equal(settings.body.user.hidePresence, true);
  assert.equal(settings.body.user.country, "BR");
  assert.equal((await ada.call("PATCH", "/me", { country: "Brazil" })).status, 400);
  assert.equal((await ada.call("PATCH", "/me", { profileVisibility: "secret" })).status, 400);

  // Strangers see the name and nothing else.
  const hidden = await visitor("GET", "/players/ada");
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.private, true);
  assert.equal(hidden.body.stats, undefined);
  assert.equal(hidden.body.user.online, false);
  assert.equal((await bob.call("GET", "/players/ada")).body.private, true);

  // Friends see it all, but never the presence she hides.
  await befriend(ada, bob);
  const shown = await bob.call("GET", "/players/ada");
  assert.equal(shown.body.private, false);
  assert.equal(shown.body.user.online, false);
  assert.equal(shown.body.user.country, "BR");
  assert.ok(shown.body.stats);
  // Her own profile is always hers to see.
  assert.equal((await ada.call("GET", "/players/ada")).body.private, false);
});

test("leaderboards: one country's players", async () => {
  const { player, browser } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  await ada.call("PATCH", "/me", { country: "PT" });
  await bob.call("PATCH", "/me", { country: "PT" });
  await cy.call("PATCH", "/me", { country: "BR" });
  const day = utcDay();
  for (const [who, points] of [[ada, 500], [bob, 700], [cy, 900]] as const) {
    assert.equal((await who.call("PUT", "/results", { results: [{ game: "outline", day, points }] })).status, 204);
  }
  const mine = await ada.call("GET", `/leaderboard?day=${day}&scope=country`);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.country, "PT");
  assert.deepEqual(mine.body.rows.map((row: { user: { username: string } }) => row.user.username), ["bob", "ada"]);
  const other = await browser()("GET", `/leaderboard?day=${day}&scope=country&country=br`);
  assert.deepEqual(other.body.rows.map((row: { user: { username: string } }) => row.user.username), ["cyd"]);
  // Without a country there is no country board.
  assert.equal((await browser()("GET", `/leaderboard?day=${day}&scope=country`)).status, 400);
});

test("invitations: a newcomer and the friend who invited them become friends", async () => {
  const pusher = fakePusher();
  const { player } = world(pusher);
  const ada = await player("ada");
  const newcomer = await player("newbie", { invitedBy: "ADA" });
  const friends = await ada.call("GET", `/friends?day=${utcDay()}`);
  assert.deepEqual(friends.body.friends.map((f: { user: { username: string } }) => f.user.username), ["newbie"]);
  const inbox = await ada.call("GET", "/inbox");
  assert.equal(inbox.body.notifications[0].kind, "invite_joined");
  assert.equal(inbox.body.notifications[0].user.username, "newbie");
  assert.equal(pusher.sent.at(-1)?.userId, ada.id);
  assert.match(pusher.sent.at(-1)!.message.url, /\/u\/newbie$/);
  // A link to nobody never stops a sign-up.
  await player("other", { invitedBy: "nobody_here" });
  await player("again", { invitedBy: 42 });
  assert.ok(newcomer.id);
});

test("challenges: a link anyone can open, scores, the inbox and a duel", async () => {
  const pusher = fakePusher();
  const { player, browser, befriend } = world(pusher);
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");

  // Bad input.
  assert.equal((await ada.call("POST", "/challenges", { seed: "x", settings: SETTINGS, results: RESULTS })).status, 400);
  assert.equal((await ada.call("POST", "/challenges", { seed: "abcd1234", settings: SETTINGS, results: RESULTS.slice(1) })).status, 400);
  assert.equal(
    (await ada.call("POST", "/challenges", { seed: "abcd1234", settings: SETTINGS, results: [{ points: 1001 }, { points: 1 }] })).status,
    400,
  );
  assert.equal((await browser()("POST", "/challenges", { seed: "abcd1234", settings: SETTINGS, results: RESULTS })).status, 401);

  const made = await ada.call("POST", "/challenges", { seed: "abcd1234", settings: SETTINGS, results: RESULTS });
  assert.equal(made.status, 201);
  const id = made.body.challenge.id as string;
  assert.match(id, /^[A-Za-z0-9]{10}$/);
  assert.equal(made.body.challenge.mine.points, 1400);

  // Anyone may look; the settings come back whole.
  const seen = await browser()("GET", `/challenges/${id}`);
  assert.equal(seen.status, 200);
  assert.equal(seen.body.challenge.from.username, "ada");
  assert.equal(seen.body.challenge.stages, 2);
  assert.equal(seen.body.challenge.seed, "abcd1234");
  assert.equal(seen.body.challenge.settings.rounds["dig-site"], 0);
  assert.equal(seen.body.challenge.mine, null);
  assert.equal((await browser()("GET", "/challenges/nothere")).status, 404);

  // Bob plays it: the first score stands, and Ada hears about it.
  const played = await bob.call("POST", `/challenges/${id}/entries`, { results: [{ points: 900 }, { points: 700, detail: "2/6" }] });
  assert.equal(played.status, 200);
  assert.equal(played.body.challenge.mine.points, 1600);
  assert.deepEqual(played.body.challenge.entries.map((e: { user: { username: string } }) => e.user.username), ["bob", "ada"]);
  const again = await bob.call("POST", `/challenges/${id}/entries`, { results: [{ points: 0 }, { points: 0 }] });
  assert.equal(again.body.challenge.mine.points, 1600);
  assert.equal((await bob.call("POST", `/challenges/${id}/entries`, { results: [{ points: 0 }] })).status, 400);

  let inbox = await ada.call("GET", "/inbox");
  assert.equal(inbox.body.unread, 1);
  assert.equal(inbox.body.notifications[0].kind, "challenge_played");
  assert.equal(inbox.body.notifications[0].ref, id);
  assert.equal(inbox.body.notifications[0].points, 1600);
  assert.equal((await ada.call("GET", "/pulse")).body.notifications, 1);
  assert.equal((await ada.call("POST", "/inbox/read")).status, 204);
  inbox = await ada.call("GET", "/inbox");
  assert.equal(inbox.body.unread, 0);
  assert.equal(inbox.body.notifications[0].read, true);

  // A duel goes to a friend only.
  assert.equal((await ada.call("POST", "/challenges", { seed: "abcd1234", settings: SETTINGS, results: RESULTS, to: "cyd" })).status, 403);
  await befriend(ada, cy);
  const duel = await ada.call("POST", "/challenges", {
    seed: "efgh5678",
    settings: SETTINGS,
    results: RESULTS,
    to: "cyd",
    replyTo: id,
  });
  assert.equal(duel.status, 201);
  assert.equal(duel.body.challenge.to.username, "cyd");
  assert.equal(duel.body.challenge.replyTo, id);
  const cyInbox = await cy.call("GET", "/inbox");
  assert.equal(cyInbox.body.notifications[0].kind, "challenge");
  assert.equal(cyInbox.body.notifications[0].user.username, "ada");
  const pushed = pusher.sent.find((entry) => entry.userId === cy.id && entry.message.url === `/c/${duel.body.challenge.id}`);
  assert.ok(pushed, "the friend gets a push");

  const listed = await cy.call("GET", "/challenges");
  assert.equal(listed.body.challenges[0].id, duel.body.challenge.id);
  assert.equal(listed.body.challenges[0].mine, null);
  assert.equal(listed.body.challenges[0].best, 1400);
});

test("the inbox lists conversations with friends, and the pulse ignores former friends", async () => {
  const { player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  await befriend(ada, bob);
  await bob.call("POST", `/chat/dm/${ada.id}`, { body: "hello" });
  await bob.call("POST", `/chat/dm/${ada.id}`, { body: "are you there?" });
  let inbox = await ada.call("GET", "/inbox");
  assert.equal(inbox.body.conversations.length, 1);
  assert.equal(inbox.body.conversations[0].user.username, "bob");
  assert.equal(inbox.body.conversations[0].last.body, "are you there?");
  assert.equal(inbox.body.conversations[0].last.mine, false);
  assert.equal(inbox.body.conversations[0].unread, 2);
  assert.equal((await ada.call("GET", "/pulse")).body.unread[0].count, 2);

  // Bob is unfriended: his messages are no longer news that can't be cleared.
  await ada.call("DELETE", `/friends/${bob.id}`);
  assert.deepEqual((await ada.call("GET", "/pulse")).body.unread, []);
  inbox = await ada.call("GET", "/inbox");
  assert.equal(inbox.body.conversations.length, 0);
});

test("friend requests and acceptances land in the inbox", async () => {
  const { player } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  await ada.call("POST", "/friends", { username: "bob" });
  assert.equal((await bob.call("GET", "/inbox")).body.notifications[0].kind, "friend_request");
  await bob.call("POST", `/friends/${ada.id}/accept`);
  assert.equal((await ada.call("GET", "/inbox")).body.notifications[0].kind, "friend_accepted");
});

test("push: subscriptions are checked, and push is off without keys", async () => {
  const off = world(createPusher(openDatabase(":memory:"), null));
  const visitor = off.browser();
  assert.equal((await visitor("GET", "/push/key")).status, 404);
  const lone = await off.player("lone");
  assert.equal((await lone.call("PUT", "/push", {})).status, 404);

  const { player, browser, db } = world();
  assert.deepEqual((await browser()("GET", "/push/key")).body, { key: "test-key" });
  const ada = await player("ada");
  const browserKey = createECDH("prime256v1");
  browserKey.generateKeys();
  const keys = { p256dh: browserKey.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
  const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys };
  assert.equal((await ada.call("PUT", "/push", good)).status, 204);
  assert.equal((await ada.call("PUT", "/push", good)).status, 204); // again: no duplicate
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get() as { n: number }).n, 1);
  // Only the browsers' push services, over https.
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://127.0.0.1/x", "https://evil.example/x", "https://fcm.googleapis.com.evil.example/x"]) {
    assert.equal((await ada.call("PUT", "/push", { endpoint, keys })).status, 400, endpoint);
  }
  assert.equal((await ada.call("PUT", "/push", { ...good, keys: { ...keys, auth: "short" } })).status, 400);
  assert.equal((await ada.call("DELETE", "/push", { endpoint: good.endpoint })).status, 204);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get() as { n: number }).n, 0);

  assert.ok(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"));
  assert.ok(isPushEndpoint("https://web.push.apple.com/x"));
  assert.ok(isPushEndpoint("https://wns2-by3p.notify.windows.com/w/?token=x"));
});

test("push: the payload decrypts with the browser's keys, and the VAPID token verifies", async () => {
  // The browser's side of RFC 8291.
  const browserKey = createECDH("prime256v1");
  browserKey.generateKeys();
  const auth = randomBytes(16);
  const subscription = { p256dh: browserKey.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
  const message = JSON.stringify({ title: "Olá", body: "Sequência em risco ⏳", url: "/daily" });
  const body = encryptPayload(Buffer.from(message), subscription);

  const salt = body.subarray(0, 16);
  const recordSize = body.readUInt32BE(16);
  const keyLength = body.readUInt8(20);
  const serverPublic = body.subarray(21, 21 + keyLength);
  const sealed = body.subarray(21 + keyLength);
  assert.equal(recordSize, 4096);
  assert.equal(keyLength, 65);
  const shared = browserKey.computeSecret(serverPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), browserKey.getPublicKey(), serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
  assert.equal(plain.at(-1), 2, "last-record delimiter");
  assert.equal(plain.subarray(0, -1).toString(), message);

  // RFC 8292: an ES256 JWT for the push service's origin, signed with our key.
  const vapid = { ...newVapidKeys(), subject: "mailto:test@example.com" };
  const token = vapidToken(vapid, "https://fcm.googleapis.com/fcm/send/abc", Date.parse("2026-11-12T00:00:00Z"));
  const [header, claims, signature] = token.split(".");
  const raw = Buffer.from(vapid.publicKey, "base64url");
  const publicKey = createPublicKey({
    key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") },
    format: "jwk",
  });
  assert.ok(
    verify("sha256", Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")),
  );
  const decoded = JSON.parse(Buffer.from(claims, "base64url").toString());
  assert.equal(decoded.aud, "https://fcm.googleapis.com");
  assert.equal(decoded.sub, "mailto:test@example.com");
});

test("push: the pusher posts to each browser and forgets the ones that are gone", async () => {
  const db = openDatabase(":memory:");
  const vapid = { ...newVapidKeys(), subject: "mailto:test@example.com" };
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const send: Send = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return { status: url.endsWith("/gone") ? 410 : 201 };
  };
  const pusher = createPusher(db, vapid, send);
  const { player } = world(pusher);
  void player;
  const app = createApp(db, config, new RateLimiter(), pusher);
  const signup = await app.request("/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "p@example.com", password: "a-long-password", username: "pat" }),
  });
  const userId = ((await signup.json()) as { user: { id: string } }).user.id;
  const key = createECDH("prime256v1");
  key.generateKeys();
  for (const end of ["live", "gone"]) {
    db.prepare("INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)").run(
      `https://fcm.googleapis.com/fcm/send/${end}`,
      userId,
      key.getPublicKey().toString("base64url"),
      randomBytes(16).toString("base64url"),
      Date.now(),
    );
  }
  await pusher.toUser(userId, { title: "t", body: "b", url: "/" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  assert.equal(calls[0].headers["Content-Encoding"], "aes128gcm");
  const left = db.prepare("SELECT endpoint FROM push_subscriptions").all() as { endpoint: string }[];
  assert.deepEqual(left.map((row) => row.endpoint), ["https://fcm.googleapis.com/fcm/send/live"]);
});

test("streak reminders: late in the day, once, to players with a streak who have not played", async () => {
  const pusher = fakePusher();
  const { player, db } = world(pusher);
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  const late = Date.parse("2026-11-20T22:30:00Z");
  const today = utcDay(late);
  const insert = db.prepare("INSERT INTO results (user_id, game, day, points, detail, created_at) VALUES (?, 'outline', ?, 500, '', 0)");
  insert.run(ada.id, today - 1); // streak 1, not played today: reminded
  insert.run(bob.id, today - 1);
  insert.run(bob.id, today); // played today: not reminded
  for (const who of [ada, bob, cy]) {
    db.prepare("INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, 'k', 'a', 0)").run(
      `https://fcm.googleapis.com/${who.username}`,
      who.id,
    );
  }
  pusher.sent.length = 0;
  assert.equal(await remindStreaks(db, pusher, Date.parse("2026-11-20T20:00:00Z")), 0, "too early");
  assert.equal(await remindStreaks(db, pusher, late), 1);
  assert.equal(pusher.sent[0].userId, ada.id);
  assert.match(pusher.sent[0].message.title, /1-day streak/);
  assert.equal(await remindStreaks(db, pusher, late + 60_000), 0, "once a day");
});

test("leagues: zones, groups of 30, and promotion and relegation when a week ends", () => {
  assert.deepEqual(zonesOf(1, 0), { promote: 1, demote: 0 });
  assert.deepEqual(zonesOf(30, 0), { promote: 5, demote: 0 });
  assert.deepEqual(zonesOf(30, 2), { promote: 5, demote: 5 });
  assert.deepEqual(zonesOf(10, 2), { promote: 2, demote: 2 });
  assert.deepEqual(zonesOf(4, 2), { promote: 1, demote: 0 });
  assert.deepEqual(zonesOf(30, 4), { promote: 0, demote: 5 });

  const db = openDatabase(":memory:");
  const week2 = Date.parse("2026-11-17T12:00:00Z"); // Tuesday of week 2
  const week3 = week2 + 7 * 86_400_000;
  const addUser = db.prepare(
    "INSERT INTO users (id, email, password_hash, username, created_at, updated_at) VALUES (?, ?, 'x', ?, 0, 0)",
  );
  const score = db.prepare("INSERT INTO results (user_id, game, day, points, detail, created_at) VALUES (?, 'outline', ?, ?, '', 0)");
  const ids: string[] = [];
  for (let i = 0; i < 31; i++) {
    const id = `u${String(i).padStart(2, "0")}`;
    ids.push(id);
    addUser.run(id, `${id}@example.com`, id);
    score.run(id, utcDay(week2), 1000 - i * 10); // u00 best … u30 worst
    joinLeague(db, id, week2 + i);
  }
  const groups = db.prepare("SELECT grp, COUNT(*) AS n FROM league_members WHERE week = 2 GROUP BY grp").all() as { grp: number; n: number }[];
  assert.deepEqual(groups.map((g) => [g.grp, g.n]), [[1, GROUP_SIZE], [2, 1]]);

  // Week 3: the top five of group 1 are promoted, the lone player of group 2 too; the rest stay (Bronze has no relegation).
  const tiers = Object.fromEntries(ids.map((id) => [id, joinLeague(db, id, week3).tier]));
  assert.deepEqual(ids.filter((id) => tiers[id] === 1), ["u00", "u01", "u02", "u03", "u04", "u30"]);

  // Week 4, in Silver: of the six, the bottom one goes back down.
  const week4 = week3 + 7 * 86_400_000;
  const silver = ["u00", "u01", "u02", "u03", "u04", "u30"];
  silver.forEach((id, i) => score.run(id, utcDay(week3), 500 - i));
  const next = Object.fromEntries(silver.map((id) => [id, joinLeague(db, id, week4).tier]));
  assert.equal(next.u00, 2);
  assert.equal(next.u30, 0);
  assert.equal(next.u02, 1);
});

test("league and Weekly Special over the API", async () => {
  const { player, browser } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  // Nothing played this week: not in a league yet.
  const before = await ada.call("GET", "/league");
  assert.equal(before.status, 200);
  assert.equal(before.body.group, null);
  assert.equal(before.body.tier, 0);
  assert.deepEqual(before.body.tiers, ["bronze", "silver", "gold", "platinum", "diamond"]);
  assert.equal((await browser()("GET", "/league")).status, 401);

  const day = utcDay();
  await ada.call("PUT", "/results", { results: [{ game: "outline", day, points: 300 }] });
  await bob.call("PUT", "/results", { results: [{ game: "who-when-where", day, points: 900 }, { game: "flag-peek", day, points: 100 }] });
  const league = await ada.call("GET", "/league");
  assert.equal(league.body.week, currentWeek());
  assert.deepEqual(
    league.body.group.rows.map((row: { user: { username: string }; points: number; zone: string | null }) => [row.user.username, row.points, row.zone]),
    [["bob", 1000, "up"], ["ada", 300, null]],
  );

  // The Weekly Special: this week only, the first score stands.
  const week = currentWeek();
  assert.equal((await ada.call("PUT", "/weekly", { week, results: RESULTS })).status, 204);
  assert.equal((await ada.call("PUT", "/weekly", { week, results: [{ points: 0 }] })).status, 204);
  assert.equal((await bob.call("PUT", "/weekly", { week: week - 1, results: RESULTS })).status, week > 1 ? 409 : 400);
  assert.equal((await bob.call("PUT", "/weekly", { week, results: [] })).status, 400);
  const board = await ada.call("GET", "/weekly");
  assert.equal(board.body.players, 1);
  assert.equal(board.body.rows[0].points, 1400);
  assert.equal(board.body.me.rank, 1);
  assert.equal(board.body.me.results.length, 2);
  const open = await browser()("GET", `/weekly?week=${week}`);
  assert.equal(open.body.me, null);
  assert.equal((await browser()("GET", `/weekly?week=${week + 1}`)).status, 400);
});

test("deleting an account takes its challenges, notifications and league places with it", async () => {
  const { player, db, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  await befriend(ada, bob);
  await ada.call("POST", "/challenges", { seed: "abcd1234", settings: SETTINGS, results: RESULTS, to: "bob" });
  await ada.call("PUT", "/results", { results: [{ game: "outline", day: utcDay(), points: 300 }] });
  await ada.call("GET", "/league");
  assert.equal((await ada.call("DELETE", "/me", { password: "a-long-password" })).status, 204);
  for (const table of ["challenges", "challenge_entries", "notifications", "league_members"]) {
    assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, 0, table);
  }
});
