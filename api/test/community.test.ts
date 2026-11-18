import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import { utcDay } from "../src/days.ts";
import { openDatabase } from "../src/db.ts";
import type { DatabaseSync } from "node:sqlite";
import { SESSION_COOKIE } from "../src/sessions.ts";

const config: Config = {
  host: "127.0.0.1",
  port: 0,
  databasePath: ":memory:",
  secureCookies: false,
  trustProxy: false,
};

const SETTINGS = {
  rounds: { "who-when-where": 1, wayfarer: 1, "dig-site": 0, "first-to-last": 0 },
  order: "grouped",
  timeLimit: 0,
  digs: 5,
  guesses: 6,
  attempts: 3,
  pace: "free",
};

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

function world() {
  const db = openDatabase(":memory:");
  const app = createApp(db, config);

  function browser() {
    let cookie = "";
    const call: Call = async (method, path, body) => {
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
    return call;
  }

  async function player(username: string) {
    const call = browser();
    const created = await call("POST", "/auth/signup", {
      email: `${username}@example.com`,
      password: "a-long-password",
      username,
    });
    assert.equal(created.status, 201);
    return { call, id: created.body.user.id as string, username };
  }

  async function befriend(a: Awaited<ReturnType<typeof player>>, b: Awaited<ReturnType<typeof player>>) {
    assert.equal((await a.call("POST", "/friends", { username: b.username })).status, 201);
    assert.equal((await b.call("POST", `/friends/${a.id}/accept`)).status, 200);
  }

  return { db, browser, player, befriend };
}

test("nudges: one a day, friends only, and it lands in the inbox", async () => {
  const { browser, player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  await befriend(ada, bob);
  const today = utcDay();

  const late = browser();
  await late("POST", "/auth/signup", { email: "late@example.com", password: "a-long-password" });
  assert.equal((await late("POST", "/nudges", { userId: bob.id })).body.error, "username_required");
  assert.equal((await browser()("POST", "/nudges", { userId: bob.id })).status, 401);

  assert.equal((await ada.call("POST", "/nudges", { userId: ada.id })).body.error, "self");
  assert.equal((await ada.call("POST", "/nudges", { userId: cy.id })).body.error, "not_friends");
  assert.equal((await ada.call("POST", "/nudges", { userId: "missing" })).body.error, "no_such_player");

  assert.equal((await ada.call("POST", "/nudges", { userId: bob.id })).status, 204);
  assert.deepEqual((await ada.call("GET", `/nudges?day=${today}`)).body.sent, [bob.id]);
  assert.equal((await ada.call("POST", "/nudges", { userId: bob.id })).body.error, "already_nudged");

  const inbox = await bob.call("GET", "/inbox");
  assert.equal(inbox.body.notifications[0].kind, "nudge");
  assert.equal(inbox.body.notifications[0].user.username, "ada");

  await bob.call("PUT", "/results", { results: [{ game: "wayfarer", day: today, points: 400, detail: "4/6" }] });
  assert.equal((await ada.call("POST", "/nudges", { userId: bob.id })).body.error, "already_nudged");
  const fresh = await player("fay");
  await befriend(fresh, bob);
  assert.equal((await fresh.call("POST", "/nudges", { userId: bob.id })).body.error, "already_played");
});

test("reactions: one per friend per day, replaced by the next, emoji whitelist", async () => {
  const { player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  await befriend(ada, bob);
  const today = utcDay();

  assert.equal((await ada.call("PUT", "/reactions", { userId: bob.id, emoji: "sparkle" })).body.field, "emoji");
  assert.equal((await ada.call("PUT", "/reactions", { userId: bob.id, emoji: "pin", game: "chess" })).body.field, "game");
  assert.equal((await ada.call("PUT", "/reactions", { userId: ada.id, emoji: "pin" })).body.error, "self");
  assert.equal((await ada.call("PUT", "/reactions", { userId: cy.id, emoji: "pin" })).body.error, "not_friends");

  assert.equal((await ada.call("PUT", "/reactions", { userId: bob.id, emoji: "fire" })).body.emoji, "fire");
  assert.equal((await ada.call("PUT", "/reactions", { userId: bob.id, emoji: "clap" })).body.emoji, "clap");

  const list = (await bob.call("GET", `/reactions?day=${today}`)).body.reactions;
  assert.equal(list.length, 1);
  assert.equal(list[0].emoji, "clap");
  assert.equal(list[0].game, "all");
  assert.equal(list[0].toId, bob.id);
  assert.equal(list[0].from.username, "ada");
  assert.equal((await ada.call("GET", `/reactions?day=${today}`)).body.reactions.length, 1);
});

test("clubs: one owned club, real members, today's scores", async () => {
  const { db, player } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  const today = utcDay();

  assert.equal((await ada.call("POST", "/clubs", { name: "ab" })).body.field, "name");
  assert.equal((await ada.call("POST", "/clubs", { name: "x".repeat(33) })).body.field, "name");

  const made = await ada.call("POST", "/clubs", { name: "Atlas Norte" });
  assert.equal(made.status, 201);
  const slug = made.body.club.slug as string;
  assert.equal(made.body.club.members.length, 1);
  assert.equal(made.body.club.members[0].role, "owner");
  assert.equal((await ada.call("POST", "/clubs", { name: "Outro" })).body.error, "club_exists");

  assert.equal((await bob.call("GET", `/clubs/${slug}`)).body.error, "not_in_club");
  assert.equal((await ada.call("POST", `/clubs/${slug}/members`, { username: "nobody" })).body.error, "no_such_player");
  assert.equal((await ada.call("POST", `/clubs/${slug}/members`, { username: "ada" })).body.error, "self");
  assert.equal((await bob.call("POST", `/clubs/${slug}/members`, { username: "cyd" })).body.error, "not_host");

  const invited = await ada.call("POST", `/clubs/${slug}/members`, { username: "bob" });
  assert.equal(invited.status, 200);
  assert.equal(invited.body.club.members.length, 2);
  // Inviting someone who is already in changes nothing.
  assert.equal((await ada.call("POST", `/clubs/${slug}/members`, { username: "bob" })).body.club.members.length, 2);

  await ada.call("PUT", "/results", { results: [{ game: "wayfarer", day: today, points: 800, detail: "2/6" }] });
  await bob.call("PUT", "/results", { results: [{ game: "dig-site", day: today, points: 500, detail: "3/5" }] });
  await cy.call("PUT", "/results", { results: [{ game: "wayfarer", day: today, points: 1000, detail: "1/6" }] });

  const board = (await bob.call("GET", `/clubs/${slug}?day=${today}`)).body.club;
  assert.equal(board.members[0].user.username, "ada");
  assert.equal(board.members[0].today.points, 800);
  assert.equal(board.members[1].today.points, 500);
  assert.equal(board.members.some((row: { user: { username: string } }) => row.user.username === "cyd"), false);

  assert.equal((await ada.call("POST", `/clubs/${slug}/leave`)).body.error, "club_owner");
  assert.equal((await bob.call("POST", `/clubs/${slug}/leave`)).status, 204);
  assert.equal((await bob.call("GET", `/clubs/${slug}`)).body.error, "not_in_club");
  await ada.call("POST", `/clubs/${slug}/members`, { username: "bob" });
  assert.equal((await bob.call("DELETE", `/clubs/${slug}/members/${cy.id}`)).body.error, "not_host");
  assert.equal((await ada.call("DELETE", `/clubs/${slug}/members/${ada.id}`)).body.error, "self");
  assert.equal((await ada.call("DELETE", `/clubs/${slug}/members/${bob.id}`)).status, 204);

  fillClub(db, made.body.club.id as string, ada.id);
  assert.equal((await ada.call("POST", `/clubs/${slug}/members`, { username: "cyd" })).body.error, "club_full");

  const mine = (await ada.call("GET", "/clubs")).body.clubs;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].role, "owner");
  assert.equal(mine[0].members, 20);
});

/** Puts the club at the 20-member cap without signing 19 people in. */
function fillClub(db: DatabaseSync, clubId: string, ownerId: string): void {
  const insertUser = db.prepare(
    "INSERT INTO users (id, email, password_hash, created_at, updated_at, username) VALUES (?, ?, 'x', 1, 1, ?)",
  );
  const insertMember = db.prepare("INSERT INTO club_members (club_id, user_id, created_at) VALUES (?, ?, 1)");
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM club_members WHERE club_id = ?").get(clubId) as {
    total: number;
  };
  for (let i = total; i < 20; i++) {
    const id = `fill-${i}`;
    insertUser.run(id, `${id}@example.com`, `fill${i}`);
    insertMember.run(clubId, id);
  }
  assert.notEqual(ownerId, "");
}

test("rematch: the host gets a new lobby with the same settings", async () => {
  const { player } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const opened = await ada.call("POST", "/parties", { name: "Friday night", settings: SETTINGS, visibility: "public" });
  assert.equal(opened.status, 201);
  const code = opened.body.party.code as string;
  await bob.call("POST", "/parties/join", { code });

  assert.equal((await bob.call("POST", `/parties/${code}/rematch`)).body.error, "not_host");
  assert.equal((await ada.call("POST", "/parties/nope/rematch")).body.error, "no_such_party");

  const again = await ada.call("POST", `/parties/${code}/rematch`);
  assert.equal(again.status, 201);
  assert.notEqual(again.body.code, code);
  assert.equal(again.body.name, "Friday night");

  const next = await ada.call("GET", `/parties/${again.body.code}`);
  assert.equal(next.body.party.status, "lobby");
  assert.equal(next.body.party.hostId, ada.id);
  assert.equal(next.body.party.visibility, "public");
  assert.deepEqual(next.body.party.settings, opened.body.party.settings);
  assert.equal(next.body.members.length, 1);

  // The room they were in is still there.
  assert.equal((await bob.call("GET", `/parties/${code}`)).status, 200);
});
