import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import { latestDay, streakOf, streaks, utcDay } from "../src/days.ts";
import { DAILY_SET } from "../src/validate.ts";
import type { Streak, StreakRules } from "../src/days.ts";

// The site's own copies, which the API's must match. Loaded at run time only: the
// site is a separate package, and is not deployed with the API.
const site = {
  dailies: (await import(new URL("../../games/daily-set.ts", import.meta.url).href)) as { DAILY_SET: readonly string[] },
  streak: (await import(new URL("../../lib/streak.ts", import.meta.url).href)) as {
    STRICT_RULES: StreakRules;
    streakOf: (days: number[], today: number, rules?: StreakRules) => Streak;
  },
};
import { openDatabase } from "../src/db.ts";
import { deleteStaleParties } from "../src/parties.ts";
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

/** One API and database, visited by any number of browsers. */
function world() {
  const db = openDatabase(":memory:");
  const app = createApp(db, config);

  /** A browser: it keeps its session cookie. */
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

  /** A browser signed in to a new account. */
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

test("the puzzle calendar", () => {
  const launch = Date.UTC(2026, 10, 10);
  assert.equal(utcDay(launch), 1);
  assert.equal(utcDay(launch + 86_400_000 - 1), 1);
  assert.equal(utcDay(launch + 86_400_000), 2);
  assert.equal(latestDay(launch + 11 * 3_600_000), 2); // already tomorrow at UTC+14

  const noon = launch + 9.5 * 86_400_000; // day 10
  // Day 4 spends the starting freeze; day 5 has none left.
  assert.deepEqual(streaks([1, 2, 3, 7, 8, 9], noon), { streak: 3, longest: 3, freezes: 0 });
  // Day 5 is frozen, so 1–6 is one run of five; day 7 breaks it.
  assert.deepEqual(streaks([1, 2, 3, 4, 6], noon), { streak: 0, longest: 5, freezes: 0 });
  assert.deepEqual(streaks([], noon), { streak: 0, longest: 0, freezes: 1 });
});

test("the streak rule: today never breaks it, a freeze saves one missed day, 7 days played earn one back", () => {
  // Today (10) not played yet: the run to yesterday stands.
  assert.deepEqual(streakOf([7, 8, 9], 10), { streak: 3, longest: 3, freezes: 1, frozen: [], playedToday: false });
  assert.equal(streakOf([7, 8, 9, 10], 10).playedToday, true);
  // Yesterday missed: the freeze is spent and the run goes on.
  assert.deepEqual(streakOf([6, 7, 8], 10), { streak: 3, longest: 3, freezes: 0, frozen: [9], playedToday: false });
  // Two days missed: the run is over, whatever came before.
  assert.equal(streakOf([5, 6, 7], 10).streak, 0);
  // Seven days played earn the freeze back (holding one at most).
  const week = [1, 2, 3, 5, 6, 7, 8, 9];
  assert.deepEqual(streakOf(week, 10), { streak: 8, longest: 8, freezes: 1, frozen: [4], playedToday: false });
  // Days to come, and nonsense, count for nothing.
  assert.equal(streakOf([9, 11, 12, 0, -3, 2.5], 10).streak, 1);
});

test("the API's streak rule and dailies are the site's", () => {
  assert.deepEqual([...DAILY_SET], [...site.dailies.DAILY_SET]);

  // Random histories: both rules must say the same thing, day for day.
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let round = 0; round < 300; round++) {
    const today = 1 + Math.floor(random() * 80);
    const days = Array.from({ length: today + 3 }, (_, i) => i + 1).filter(() => random() < 0.75);
    assert.deepEqual(streakOf(days, today), site.streak.streakOf(days, today));
    const strict = site.streak.STRICT_RULES;
    assert.deepEqual(streakOf(days, today, strict), site.streak.streakOf(days, today, strict));
  }
});

test("usernames: chosen at sign-up or later, unique, and needed to take part", async () => {
  const { browser, player } = world();
  const ada = await player("ada");

  const late = browser();
  const created = await late("POST", "/auth/signup", { email: "late@example.com", password: "a-long-password" });
  assert.equal(created.body.user.username, null);
  assert.equal((await late("POST", "/friends", { username: "ada" })).body.error, "username_required");
  assert.equal((await late("POST", "/chat/global", { body: "hi" })).body.error, "username_required");

  assert.equal((await late("PATCH", "/me", { username: "Ada" })).body.error, "username_taken");
  assert.equal((await late("PATCH", "/me", { username: "x" })).body.field, "username");
  assert.equal((await late("PATCH", "/me", { username: "has space" })).body.field, "username");
  const renamed = await late("PATCH", "/me", { username: "Grace_H", avatar: 5 });
  assert.equal(renamed.body.user.username, "grace_h");
  assert.equal(renamed.body.user.avatar, 5);
  assert.equal((await late("PATCH", "/me", { avatar: 99 })).body.field, "avatar");

  const again = browser();
  const clash = await again("POST", "/auth/signup", {
    email: "other@example.com",
    password: "a-long-password",
    username: "ada",
  });
  assert.equal(clash.status, 409);
  assert.equal(clash.body.error, "username_taken");

  // Other players never see an e-mail address.
  const found = await ada.call("GET", "/players?q=gra");
  assert.deepEqual(Object.keys(found.body.players[0].user).sort(), ["avatar", "country", "id", "name", "online", "username"]);
});

test("friends: ask, accept, decline, remove", async () => {
  const { player } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");

  assert.equal((await ada.call("POST", "/friends", { username: "nobody" })).body.error, "no_such_player");
  assert.equal((await ada.call("POST", "/friends", { username: "ada" })).body.error, "self");

  assert.equal((await ada.call("POST", "/friends", { username: "bob" })).body.relation, "outgoing");
  assert.equal((await ada.call("POST", "/friends", { username: "bob" })).body.relation, "outgoing");
  assert.equal((await bob.call("GET", "/pulse")).body.requests, 1);
  assert.equal((await bob.call("GET", "/friends")).body.incoming[0].username, "ada");
  assert.equal((await ada.call("GET", "/friends")).body.outgoing[0].username, "bob");
  // Only the one who was asked can accept.
  assert.equal((await ada.call("POST", `/friends/${bob.id}/accept`)).status, 404);
  assert.equal((await bob.call("POST", `/friends/${ada.id}/accept`)).body.relation, "friends");
  assert.equal((await bob.call("GET", "/pulse")).body.requests, 0);
  assert.equal((await ada.call("GET", "/friends")).body.friends[0].user.username, "bob");

  // Asking someone who already asked you makes you friends.
  await cy.call("POST", "/friends", { username: "ada" });
  assert.equal((await ada.call("POST", "/friends", { username: "cyd" })).body.relation, "friends");
  assert.equal((await ada.call("GET", "/friends")).body.friends.length, 2);

  assert.equal((await ada.call("GET", "/players/bob")).body.relation, "friends");
  assert.equal((await bob.call("GET", "/players/cyd")).body.relation, "none");

  assert.equal((await ada.call("DELETE", `/friends/${bob.id}`)).status, 204);
  assert.equal((await bob.call("GET", "/friends")).body.friends.length, 0);
});

test("scores: first one stands; leaderboards by day, game and friends", async () => {
  const { browser, player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  await befriend(ada, bob);
  const today = utcDay();

  const put = (who: typeof ada, results: unknown[]) => who.call("PUT", "/results", { results });
  assert.equal(
    (
      await put(ada, [
        { game: "wayfarer", day: today, points: 700, detail: "3/6" },
        { game: "dig-site", day: today, points: 1000, detail: "1/5" },
      ])
    ).status,
    204,
  );
  await put(ada, [{ game: "wayfarer", day: today, points: 1000, detail: "1/6" }]); // too late: 700 stands
  await put(bob, [{ game: "wayfarer", day: today, points: 850, detail: "2/6" }]);
  await put(cy, [{ game: "wayfarer", day: today, points: 850, detail: "2/6" }]);

  assert.equal((await put(ada, [{ game: "chess", day: today, points: 1 }])).body.field, "results.game");
  assert.equal((await put(ada, [{ game: "wayfarer", day: today, points: 1001 }])).body.field, "results.points");
  assert.equal((await put(ada, [{ game: "wayfarer", day: latestDay() + 1, points: 1 }])).body.field, "results.day");

  // Anyone can read the board; it lists handles, best total first.
  const guest = browser();
  const all = (await guest("GET", `/leaderboard?day=${today}`)).body;
  assert.deepEqual(
    all.rows.map((row: { user: { username: string }; points: number; rank: number }) => [
      row.user.username,
      row.points,
      row.rank,
    ]),
    [
      ["ada", 1700, 1],
      ["bob", 850, 2],
      ["cyd", 850, 2],
    ],
  );
  assert.equal(all.me, null);
  assert.equal(all.players, 3);

  const wayfarer = (await cy.call("GET", `/leaderboard?day=${today}&game=wayfarer`)).body;
  assert.equal(wayfarer.rows[0].points, 850);
  assert.deepEqual(wayfarer.me, { rank: 1, points: 850, puzzles: 1 });
  assert.equal(wayfarer.rows.at(-1).user.username, "ada");

  const friends = (await bob.call("GET", `/leaderboard?day=${today}&scope=friends&period=week`)).body;
  assert.deepEqual(
    friends.rows.map((row: { user: { username: string } }) => row.user.username),
    ["ada", "bob"],
  );
  assert.equal(friends.me.rank, 2);
  assert.equal((await guest("GET", "/leaderboard?scope=friends")).status, 401);
  assert.equal((await guest("GET", "/leaderboard?period=year")).body.field, "period");

  // The profile adds it all up.
  const profile = (await guest("GET", "/players/ADA")).body;
  assert.equal(profile.user.username, "ada");
  assert.equal(profile.relation, null);
  assert.equal(profile.stats.points, 1700);
  assert.equal(profile.stats.puzzles, 2);
  assert.equal(profile.stats.streak, 1);
  assert.deepEqual(profile.activity, [{ day: today, puzzles: 2, points: 1700 }]);
  assert.equal((await guest("GET", "/players/nobody")).status, 404);

  // Friends come with what they scored today.
  const list = (await bob.call("GET", `/friends?day=${today}`)).body;
  assert.deepEqual(list.friends[0].today, { points: 1700, puzzles: 2 });
});

test("chat: the global room, and direct messages between friends", async () => {
  const { player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  await befriend(ada, bob);

  const first = await ada.call("POST", "/chat/global", { body: "  hello\n\tworld  " });
  assert.equal(first.status, 201);
  assert.equal(first.body.message.body, "hello world");
  assert.equal(first.body.message.user.username, "ada");
  await bob.call("POST", "/chat/global", { body: "hi ada" });
  assert.equal((await ada.call("POST", "/chat/global", { body: "   " })).body.field, "body");
  assert.equal((await ada.call("POST", "/chat/global", { body: "x".repeat(501) })).body.field, "body");

  const room = (await cy.call("GET", "/chat/global")).body.messages;
  assert.deepEqual(
    room.map((message: { body: string }) => message.body),
    ["hello world", "hi ada"],
  );
  const since = (await cy.call("GET", `/chat/global?after=${room[0].id}`)).body.messages;
  assert.equal(since.length, 1);
  assert.equal(since[0].body, "hi ada");

  // Direct messages: friends only, and unread ones show in the pulse.
  assert.equal((await cy.call("POST", `/chat/dm/${ada.id}`, { body: "psst" })).body.error, "not_friends");
  assert.equal((await cy.call("GET", `/chat/dm/${ada.id}`)).status, 403);
  await ada.call("POST", `/chat/dm/${bob.id}`, { body: "one" });
  await ada.call("POST", `/chat/dm/${bob.id}`, { body: "two" });
  assert.deepEqual((await bob.call("GET", "/pulse")).body.unread, [{ userId: ada.id, count: 2 }]);
  assert.deepEqual((await ada.call("GET", "/pulse")).body.unread, []);

  const thread = (await bob.call("GET", `/chat/dm/${ada.id}`)).body.messages;
  assert.deepEqual(
    thread.map((message: { body: string }) => message.body),
    ["one", "two"],
  );
  assert.deepEqual((await bob.call("GET", "/pulse")).body.unread, []); // reading marks it read
  assert.equal((await cy.call("GET", "/chat/global")).body.messages.length, 2); // and stays private
});

test("parties: open, join, play a run, scores in order", async () => {
  const { player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");
  await befriend(ada, bob);

  assert.equal((await ada.call("POST", "/parties", { settings: { ...SETTINGS, digs: 9 } })).body.field, "settings.digs");
  const none = { ...SETTINGS, rounds: { "who-when-where": 0, wayfarer: 0, "dig-site": 0, "first-to-last": 0 } };
  assert.equal((await ada.call("POST", "/parties", { settings: none })).body.field, "settings.rounds");

  const opened = await ada.call("POST", "/parties", { name: "Friday night", settings: SETTINGS, visibility: "public" });
  assert.equal(opened.status, 201);
  const code: string = opened.body.party.code;
  assert.match(code, /^[A-Z2-9]{5}$/);
  assert.equal(opened.body.party.hostId, ada.id);
  assert.equal(opened.body.party.status, "lobby");

  // Listed for others; an invitation reaches a friend's pulse.
  assert.equal((await cy.call("GET", "/parties")).body.open[0].code, code);
  assert.equal((await ada.call("GET", "/parties")).body.mine[0].code, code);
  assert.equal((await ada.call("POST", `/parties/${code}/invite`, { userId: cy.id })).body.error, "not_friends");
  assert.equal((await ada.call("POST", `/parties/${code}/invite`, { userId: bob.id })).status, 204);
  assert.equal((await bob.call("GET", "/pulse")).body.invites[0].code, code);

  assert.equal((await bob.call("GET", `/parties/${code}`)).body.error, "not_member");
  const joined = await bob.call("POST", "/parties/join", { code: code.toLowerCase() });
  assert.equal(joined.body.members.length, 2);
  assert.deepEqual((await bob.call("GET", "/pulse")).body.invites, []);
  assert.equal((await bob.call("POST", "/parties/join", { code: "ZZZZZ" })).status, 404);

  // Only the host runs the room.
  assert.equal((await bob.call("POST", `/parties/${code}/start`)).body.error, "not_host");
  assert.equal((await bob.call("PATCH", `/parties/${code}`, { name: "mine" })).body.error, "not_host");
  const changed = await ada.call("PATCH", `/parties/${code}`, { settings: { ...SETTINGS, pace: "together" } });
  assert.equal(changed.body.party.settings.pace, "together");
  assert.equal((await bob.call("POST", `/parties/${code}/results`, { run: 1, stage: 0, points: 5 })).body.error, "run_over");

  const started = await ada.call("POST", `/parties/${code}/start`);
  assert.equal(started.body.party.status, "playing");
  assert.equal(started.body.party.run, 1);
  assert.ok(started.body.party.seed.length >= 6);
  assert.equal((await ada.call("PATCH", `/parties/${code}`, { name: "late" })).body.error, "in_progress");

  // Someone who comes in mid-run watches.
  await cy.call("POST", "/parties/join", { code });
  const watching = (await cy.call("GET", `/parties/${code}`)).body;
  assert.equal(watching.members.find((member: { user: { id: string } }) => member.user.id === cy.id).spectator, true);
  assert.equal((await cy.call("POST", `/parties/${code}/results`, { run: 1, stage: 0, points: 5 })).body.error, "spectator");

  const score = (who: typeof ada, stage: number, points: number) =>
    who.call("POST", `/parties/${code}/results`, { run: 1, stage, points, detail: `${points}` });
  assert.equal((await score(bob, 1, 400)).body.error, "out_of_order");
  assert.equal((await score(bob, 0, 400)).status, 204);
  assert.equal((await score(bob, 0, 999)).status, 204); // already scored: ignored
  assert.equal((await score(bob, 1, 250)).status, 204);
  assert.equal((await score(bob, 2, 250)).body.field, "stage"); // the run has two puzzles
  assert.equal((await score(ada, 0, 1001)).body.field, "points");
  assert.equal((await score(ada, 0, 1000)).status, 204);
  assert.equal((await ada.call("POST", `/parties/${code}/release`, { stage: 0 })).body.party.released, 0);

  // A run still in progress is not restarted over the players in it (ada has one puzzle left).
  assert.equal((await ada.call("POST", `/parties/${code}/start`)).body.error, "run_in_progress");

  await bob.call("POST", `/parties/${code}/chat`, { body: "gg" });
  const state = (await ada.call("GET", `/parties/${code}`)).body;
  const results = Object.fromEntries(
    state.members.map((member: { user: { username: string }; results: { points: number }[] }) => [
      member.user.username,
      member.results.map((result) => result.points),
    ]),
  );
  assert.deepEqual(results, { ada: [1000], bob: [400, 250], cyd: [] });
  assert.equal(state.messages[0].body, "gg");
  assert.deepEqual((await ada.call("GET", `/parties/${code}?after=${state.messages[0].id}`)).body.messages, []);
  assert.equal((await cy.call("POST", "/chat/global", { body: "outside" })).status, 201);
  assert.equal((await ada.call("GET", `/parties/${code}`)).body.messages.length, 1); // rooms do not leak

  // Back to the lobby, then a second run starts clean.
  assert.equal((await ada.call("POST", `/parties/${code}/lobby`)).body.party.status, "lobby");
  const second = (await ada.call("POST", `/parties/${code}/start`)).body;
  assert.equal(second.party.run, 2);
  assert.notEqual(second.party.seed, started.body.party.seed);
  assert.equal(second.party.released, -1);
  assert.ok(second.members.every((member: { results: unknown[]; spectator: boolean }) => !member.results.length && !member.spectator));
});

test("parties: kicking, leaving, and closing", async () => {
  const { db, player } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  const cy = await player("cyd");

  const code: string = (await ada.call("POST", "/parties", { settings: SETTINGS })).body.party.code;
  assert.deepEqual((await cy.call("GET", "/parties")).body.open, []); // private: not listed
  await bob.call("POST", "/parties/join", { code });
  await cy.call("POST", "/parties/join", { code });

  assert.equal((await bob.call("POST", `/parties/${code}/kick`, { userId: cy.id })).body.error, "not_host");
  assert.equal((await ada.call("POST", `/parties/${code}/kick`, { userId: cy.id })).body.members.length, 2);
  assert.equal((await cy.call("GET", `/parties/${code}`)).body.error, "not_member");
  // Removed means removed: the same code does not let them back in.
  assert.equal((await cy.call("POST", "/parties/join", { code })).body.error, "banned");

  // The host leaves: the room passes to whoever has been there longest.
  assert.equal((await ada.call("POST", `/parties/${code}/leave`)).status, 204);
  assert.equal((await bob.call("GET", `/parties/${code}`)).body.party.hostId, bob.id);
  await bob.call("POST", `/parties/${code}/chat`, { body: "alone" });

  // The last one out closes it, and its chat goes with it.
  assert.equal((await bob.call("POST", `/parties/${code}/leave`)).status, 204);
  assert.equal((await bob.call("POST", "/parties/join", { code })).status, 404);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }).n, 0);

  // A room everyone walked away from is closed in time.
  const other: string = (await cy.call("POST", "/parties", { settings: SETTINGS })).body.party.code;
  deleteStaleParties(db, Date.now() + 5 * 60 * 60 * 1000);
  assert.equal((await cy.call("GET", `/parties/${other}`)).status, 200);
  deleteStaleParties(db, Date.now() + 7 * 60 * 60 * 1000);
  assert.equal((await cy.call("GET", `/parties/${other}`)).status, 404);
});

test("deleting an account removes its traces", async () => {
  const { db, player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  await befriend(ada, bob);
  await ada.call("POST", "/chat/global", { body: "bye" });
  await ada.call("POST", `/chat/dm/${bob.id}`, { body: "bye bob" });
  await ada.call("PUT", "/results", { results: [{ game: "wayfarer", day: 1, points: 700 }] });
  const code: string = (await ada.call("POST", "/parties", { settings: SETTINGS })).body.party.code;
  await bob.call("POST", "/parties/join", { code });

  assert.equal((await ada.call("DELETE", "/me", { password: "a-long-password" })).status, 204);
  for (const table of ["messages", "results", "friendships", "parties"]) {
    assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, 0, table);
  }
  assert.equal((await bob.call("GET", "/friends")).body.friends.length, 0);
});

/** The engine games (waves 1 and 2): none of their puzzles in a party from before them. */
const NEWER_GAMES_OFF = Object.fromEntries(
  [
    "lifelines",
    "clue-ladder",
    "born-here",
    "could-they-meet",
    "earlier-or-later",
    "same-year",
    "pin-the-city",
    "click-the-country",
    "type-the-countries",
    "flag-peek",
    "higher-or-lower",
    "border-chain",
    "timeline",
    "year-snap",
    "landmark-lens",
    "true-size",
    "rivers-and-ranges",
    "life-tracks",
    "quickplay",
    "gauntlet",
  ].map((game) => [game, 0]),
);

/** Their usual tries, for the ones that let a host set them. */
const NEWER_TRIES = { lifelines: 3, "clue-ladder": 6, "click-the-country": 3, "flag-peek": 6, timeline: 3, "life-tracks": 5 };

test("the newer games keep scores; party settings from before them are made whole", async () => {
  const { player } = world();
  const ada = await player("ada");
  const today = utcDay();

  const put = await ada.call("PUT", "/results", {
    results: [
      { game: "overland", day: today, points: 813, detail: "4/7" },
      { game: "outline", day: today, points: 1000, detail: "1/6" },
    ],
  });
  assert.equal(put.status, 204);
  assert.equal((await ada.call("GET", `/leaderboard?day=${today}&game=outline`)).body.rows[0].points, 1000);

  // SETTINGS is what a page loaded before Overland and Outline existed would send.
  const old = (await ada.call("POST", "/parties", { settings: SETTINGS })).body.party;
  assert.deepEqual(old.settings.rounds, { ...SETTINGS.rounds, overland: 0, outline: 0, ...NEWER_GAMES_OFF });
  assert.equal(old.settings.spare, 4);

  const settings = { ...SETTINGS, rounds: { ...SETTINGS.rounds, overland: 2, outline: 1 }, spare: 2 };
  const party = (await ada.call("POST", "/parties", { settings })).body.party;
  assert.equal(party.settings.rounds.overland, 2);
  assert.equal(party.settings.spare, 2);
  assert.equal(
    (await ada.call("POST", "/parties", { settings: { ...settings, spare: 9 } })).body.field,
    "settings.spare",
  );
});

test("party settings: tries are kept per game, and still read under their older names", async () => {
  const { player } = world();
  const ada = await player("ada");

  // SETTINGS is what a page from before per-game tries sends: the older names only.
  const old = (await ada.call("POST", "/parties", { settings: { ...SETTINGS, guesses: 4 } })).body.party;
  assert.deepEqual(old.settings.tries, { wayfarer: 4, "dig-site": 5, "first-to-last": 3, overland: 4, outline: 4, ...NEWER_TRIES });

  // Today's page sends both. The per-game tries win, each game has its own…
  const tries = { wayfarer: 3, "dig-site": 4, "first-to-last": 2, overland: 1, outline: 6, ...NEWER_TRIES, lifelines: 2 };
  const party = (await ada.call("POST", "/parties", { settings: { ...SETTINGS, tries } })).body.party;
  assert.deepEqual(party.settings.tries, tries);
  // …and a page that only knows the older names is still answered in them.
  assert.equal(party.settings.guesses, 3);
  assert.equal(party.settings.digs, 4);
  assert.equal(party.settings.attempts, 2);
  assert.equal(party.settings.spare, 1);

  // The per-game tries are enough on their own; a game they leave out plays by its usual tries.
  const lean = { rounds: SETTINGS.rounds, order: "grouped", timeLimit: 0, pace: "free", tries: { outline: 5 } };
  const made = (await ada.call("POST", "/parties", { settings: lean })).body.party;
  assert.deepEqual(made.settings.tries, { wayfarer: 6, "dig-site": 5, "first-to-last": 3, overland: 4, outline: 5, ...NEWER_TRIES });

  assert.equal(
    (await ada.call("POST", "/parties", { settings: { ...lean, tries: { outline: 9 } } })).body.field,
    "settings.tries",
  );

  const changed = await ada.call("PATCH", `/parties/${made.code}`, { settings: { ...lean, tries: { wayfarer: 4, outline: 3 } } });
  assert.equal(changed.body.party.settings.tries.wayfarer, 4);
  assert.equal(changed.body.party.settings.tries.outline, 3);
});

test("engine games keep scores on their own boards; the dailies add up the daily set", async () => {
  const { browser, player, befriend } = world();
  const ada = await player("ada");
  const bob = await player("bob");
  await befriend(ada, bob);
  const today = utcDay();

  const put = await ada.call("PUT", "/results", {
    results: [
      { game: "wayfarer", day: today, points: 700, detail: "3/6" },
      { game: "flag-peek", day: today, points: 850, detail: "2/6" },
      { game: "higher-or-lower", day: today, points: 600, detail: "✓12/20" },
    ],
  });
  assert.equal(put.status, 204);

  const guest = browser();
  const flags = (await guest("GET", `/leaderboard?day=${today}&game=flag-peek`)).body;
  assert.equal(flags.rows[0].points, 850);
  // "All games" is the daily challenge: the newer games' points are not added in.
  const all = (await guest("GET", `/leaderboard?day=${today}`)).body;
  assert.equal(all.rows[0].points, 700);
  assert.equal(all.rows[0].puzzles, 1);

  // Friends see the day's challenge too.
  const list = (await bob.call("GET", `/friends?day=${today}`)).body;
  assert.deepEqual(list.friends[0].today, { points: 700, puzzles: 1 });

  // A full day is the five dailies, whatever else was played (Overland is no longer one of them).
  const rest = ["who-when-where", "dig-site", "first-to-last", "overland"].map((game) => ({ game, day: today, points: 500 }));
  await ada.call("PUT", "/results", { results: rest });
  assert.equal((await guest("GET", "/players/ada")).body.stats.fullDays, 0);
  await ada.call("PUT", "/results", { results: [{ game: "outline", day: today, points: 500 }] });
  const profile = (await guest("GET", "/players/ada")).body;
  assert.equal(profile.stats.fullDays, 1);
  assert.equal(profile.stats.puzzles, 8);
  assert.equal(profile.stats.streak, 1);
  assert.equal(profile.stats.freezes, 1);

  // A day of games outside the dailies alone keeps no streak going.
  const cy = await player("cyd");
  await cy.call("PUT", "/results", { results: [{ game: "flag-peek", day: today, points: 900 }] });
  assert.equal((await guest("GET", "/players/cyd")).body.stats.streak, 0);

  // A party can deal the newer games, with tries for the ones that have them.
  const settings = { ...SETTINGS, rounds: { ...SETTINGS.rounds, "border-chain": 2 }, tries: { "flag-peek": 4 } };
  const party = (await ada.call("POST", "/parties", { settings })).body.party;
  assert.equal(party.settings.rounds["border-chain"], 2);
  assert.equal(party.settings.tries["flag-peek"], 4);
});

test("the wave 2 games keep scores on their own boards, and parties can deal them", async () => {
  const { browser, player } = world();
  const ada = await player("ada");
  const today = utcDay();
  const wave = ["timeline", "year-snap", "landmark-lens", "true-size", "rivers-and-ranges", "life-tracks", "quickplay", "gauntlet"];

  const put = await ada.call("PUT", "/results", {
    results: wave.map((game, i) => ({ game, day: today, points: 500 + i * 10, detail: "x" })),
  });
  assert.equal(put.status, 204);
  const guest = browser();
  for (const [i, game] of wave.entries()) {
    assert.equal((await guest("GET", `/leaderboard?day=${today}&game=${game}`)).body.rows[0].points, 500 + i * 10, game);
  }
  // None of them is a daily: the all-games board stays empty.
  assert.equal((await guest("GET", `/leaderboard?day=${today}`)).body.rows.length, 0);

  const settings = { ...SETTINGS, rounds: { ...SETTINGS.rounds, timeline: 2, gauntlet: 1 }, tries: { timeline: 5, "life-tracks": 3 } };
  const party = (await ada.call("POST", "/parties", { settings })).body.party;
  assert.equal(party.settings.rounds.timeline, 2);
  assert.equal(party.settings.rounds.gauntlet, 1);
  assert.equal(party.settings.tries.timeline, 5);
  assert.equal(party.settings.tries["life-tracks"], 3);
  assert.equal(
    (await ada.call("POST", "/parties", { settings: { ...settings, tries: { timeline: 6 } } })).body.field,
    "settings.tries",
  );
});
