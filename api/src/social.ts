import type { Hono } from "hono";
import { earliestDay, latestDay, streaks, utcDay } from "./days.ts";
import { Failure, transaction, type Deps, type Env } from "./http.ts";
import {
  PUBLIC_COLUMNS,
  friendIds,
  friendshipOf,
  pairOf,
  placeholders,
  relationOf,
  requireUsername,
  toPublic,
  type PublicRow,
} from "./people.ts";
import { LIMITS } from "./rate-limit.ts";
import { DAILY_SET, Invalid, inChallengeSql, isGame, readChoice, readLine, readResults, readUsername } from "./validate.ts";

// Scores, leaderboards, profiles and friends.

const LEADERBOARD_SIZE = 50;
const MAX_FRIENDS = 200;
/** Days of activity on a profile: 53 weeks, like the graph that shows them. */
const ACTIVITY_DAYS = 371;
const SEARCH_RESULTS = 10;

const PERIODS = ["day", "week", "all"] as const;
const SCOPES = ["all", "friends"] as const;

function readDayQuery(value: string | undefined, now: number): number {
  if (value === undefined) return utcDay(now);
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > latestDay(now)) throw new Invalid("day");
  return day;
}

/** Routes anyone may read; a session only adds the viewer's own standing. */
export function registerPublicSocial(app: Hono<Env>, { db, viewer }: Deps): void {
  /**
   * The best totals over a day, a week or all time, for one game or all of
   * them, among everyone or the viewer's friends. `day` is the reader's own
   * "today" (defaults to UTC's).
   */
  app.get("/leaderboard", (c) => {
    const now = Date.now();
    const me = viewer(c);
    const day = readDayQuery(c.req.query("day"), now);
    const period = readChoice(c.req.query("period") ?? "day", PERIODS, "period");
    const scope = readChoice(c.req.query("scope") ?? "all", SCOPES, "scope");
    const game = c.req.query("game") ?? "all";
    if (game !== "all" && !isGame(game)) throw new Invalid("game");

    const from = period === "day" ? day : period === "week" ? Math.max(1, day - 6) : 1;
    const where = ["u.username IS NOT NULL", "r.day BETWEEN ? AND ?"];
    const params: (string | number)[] = [from, day];
    if (game !== "all") {
      where.push("r.game = ?");
      params.push(game);
    } else where.push(inChallengeSql("r")); // "All games" is the daily challenge: playing more games is not more points.
    if (scope === "friends") {
      if (!me) throw new Failure(401, "unauthenticated");
      const ids = [me.id, ...friendIds(db, me.id)];
      where.push(`r.user_id IN (${placeholders(ids.length)})`);
      params.push(...ids);
    }
    const totals = `
      SELECT r.user_id, SUM(r.points) AS points, COUNT(*) AS puzzles, MAX(r.created_at) AS last
        FROM results r JOIN users u ON u.id = r.user_id
       WHERE ${where.join(" AND ")}
       GROUP BY r.user_id`;

    const top = db
      .prepare(
        `SELECT t.points, t.puzzles, ${PUBLIC_COLUMNS}
           FROM (${totals}) t JOIN users u ON u.id = t.user_id
          ORDER BY t.points DESC, t.last ASC, u.username ASC LIMIT ${LEADERBOARD_SIZE}`,
      )
      .all(...params) as (PublicRow & { points: number; puzzles: number })[];

    // Equal totals share a rank.
    let rank = 0;
    const rows = top.map((row, i) => {
      if (i === 0 || row.points < top[i - 1].points) rank = i + 1;
      return { rank, points: row.points, puzzles: row.puzzles, user: toPublic(row, now) };
    });

    const { players } = db.prepare(`SELECT COUNT(*) AS players FROM (${totals})`).get(...params) as {
      players: number;
    };

    let mine: { rank: number; points: number; puzzles: number } | null = null;
    if (me) {
      const own = db.prepare(`SELECT points, puzzles FROM (${totals}) WHERE user_id = ?`).get(...params, me.id) as
        | { points: number; puzzles: number }
        | undefined;
      if (own) {
        const { ahead } = db
          .prepare(`SELECT COUNT(*) AS ahead FROM (${totals}) WHERE points > ?`)
          .get(...params, own.points) as { ahead: number };
        mine = { rank: ahead + 1, ...own };
      }
    }
    return c.json({ day, period, game, scope, players, rows, me: mine });
  });

  /** A player's public profile: totals, the streak (lib/streak.ts's rule) and a year of activity. */
  app.get("/players/:username", (c) => {
    const now = Date.now();
    const row = db
      .prepare(`SELECT ${PUBLIC_COLUMNS}, u.created_at FROM users u WHERE u.username = ?`)
      .get(c.req.param("username").toLowerCase()) as (PublicRow & { created_at: number }) | undefined;
    if (!row) throw new Failure(404, "no_such_player");

    const days = db
      .prepare(
        "SELECT day, COUNT(*) AS puzzles, SUM(points) AS points FROM results WHERE user_id = ? GROUP BY day ORDER BY day",
      )
      .all(row.id) as { day: number; puzzles: number; points: number }[];
    // A streak counts the days with one of the dailies finished.
    const dailyDays = (
      db.prepare(`SELECT DISTINCT day FROM results WHERE user_id = ? AND ${inChallengeSql()}`).all(row.id) as { day: number }[]
    ).map((entry) => entry.day);
    const games = db
      .prepare(
        "SELECT game, COUNT(*) AS played, SUM(points) AS points, MAX(points) AS best FROM results WHERE user_id = ? GROUP BY game",
      )
      .all(row.id) as { game: string; played: number; points: number; best: number }[];

    const me = viewer(c);
    const firstShown = latestDay(now) - ACTIVITY_DAYS + 1;
    return c.json({
      user: toPublic(row, now),
      joinedAt: row.created_at,
      relation: me ? relationOf(db, me.id, row.id) : null,
      stats: {
        points: days.reduce((sum, entry) => sum + entry.points, 0),
        puzzles: days.reduce((sum, entry) => sum + entry.puzzles, 0),
        days: days.length,
        /** Days on which every one of the dailies was finished. */
        fullDays: (
          db
            .prepare(
              `SELECT COUNT(*) AS n FROM (SELECT day FROM results WHERE user_id = ? AND ${inChallengeSql()} GROUP BY day HAVING COUNT(*) >= ?)`,
            )
            .get(row.id, DAILY_SET.length) as { n: number }
        ).n,
        ...streaks(dailyDays, now),
      },
      games,
      activity: days.filter((entry) => entry.day >= firstShown),
    });
  });
}

/** Routes that need a session. */
export function registerSocial(account: Hono<Env>, { db, limit, body }: Deps): void {
  // ── Scores ────────────────────────────────────────────────────────────────

  /** Records finished daily puzzles. A day's first score stands. */
  account.put("/results", async (c) => {
    const user = c.get("user");
    limit(`results:${user.id}`, LIMITS.resultsPerUser);
    const now = Date.now();
    const results = readResults((await body(c)).results, latestDay(now));
    const insert = db.prepare(
      "INSERT OR IGNORE INTO results (user_id, game, day, points, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    transaction(db, () => {
      for (const result of results) insert.run(user.id, result.game, result.day, result.points, result.detail, now);
    });
    return c.body(null, 204);
  });

  // ── Finding players ───────────────────────────────────────────────────────

  /** Players whose handle or name starts with `q`. */
  account.get("/players", (c) => {
    const user = c.get("user");
    limit(`search:${user.id}`, LIMITS.searchPerUser);
    const query = readLine(c.req.query("q"), 40, "q").toLowerCase();
    // LIKE's own wildcards are taken literally.
    const prefix = `${query.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = db
      .prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM users u
          WHERE u.username IS NOT NULL AND u.id <> ?
            AND (u.username LIKE ? ESCAPE '\\' OR lower(u.display_name) LIKE ? ESCAPE '\\')
          ORDER BY u.username = ? DESC, u.username LIMIT ${SEARCH_RESULTS}`,
      )
      .all(user.id, prefix, prefix, query) as PublicRow[];
    const now = Date.now();
    return c.json({
      players: rows.map((row) => ({ user: toPublic(row, now), relation: relationOf(db, user.id, row.id) })),
    });
  });

  // ── Friends ───────────────────────────────────────────────────────────────

  /** Friends, with what each scored on `day`, and the requests waiting either way. */
  account.get("/friends", (c) => {
    const user = c.get("user");
    const now = Date.now();
    const day = readDayQuery(c.req.query("day"), now);
    const rows = db
      .prepare(
        `SELECT f.status, f.requester, f.created_at AS since, ${PUBLIC_COLUMNS}
           FROM friendships f
           JOIN users u ON u.id = CASE WHEN f.low = ?1 THEN f.high ELSE f.low END
          WHERE f.low = ?1 OR f.high = ?1
          ORDER BY lower(CASE WHEN u.display_name <> '' THEN u.display_name ELSE u.username END)`,
      )
      .all(user.id) as (PublicRow & { status: string; requester: string; since: number })[];

    const accepted = rows.filter((row) => row.status === "accepted");
    const today = new Map<string, { points: number; puzzles: number }>();
    if (accepted.length) {
      const scores = db
        .prepare(
          `SELECT user_id, SUM(points) AS points, COUNT(*) AS puzzles FROM results
            WHERE day = ? AND ${inChallengeSql()} AND user_id IN (${placeholders(accepted.length)}) GROUP BY user_id`,
        )
        .all(day, ...accepted.map((row) => row.id)) as { user_id: string; points: number; puzzles: number }[];
      for (const score of scores) today.set(score.user_id, { points: score.points, puzzles: score.puzzles });
    }

    return c.json({
      friends: accepted.map((row) => ({ user: toPublic(row, now), today: today.get(row.id) ?? null })),
      incoming: rows
        .filter((row) => row.status === "pending" && row.requester !== user.id)
        .map((row) => toPublic(row, now)),
      outgoing: rows
        .filter((row) => row.status === "pending" && row.requester === user.id)
        .map((row) => toPublic(row, now)),
    });
  });

  /** Asks a player to be friends; if they had already asked, this accepts. */
  account.post("/friends", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`friends:${user.id}`, LIMITS.friendsPerUser);
    const username = readUsername((await body(c)).username);
    const target = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: string } | undefined;
    if (!target) throw new Failure(404, "no_such_player");
    if (target.id === user.id) throw new Failure(400, "self");

    const existing = friendshipOf(db, user.id, target.id);
    if (existing?.status === "accepted") return c.json({ relation: "friends" });
    if (existing) {
      if (existing.requester === user.id) return c.json({ relation: "outgoing" });
      accept(user.id, target.id);
      return c.json({ relation: "friends" });
    }

    const { total } = db
      .prepare("SELECT COUNT(*) AS total FROM friendships WHERE low = ?1 OR high = ?1")
      .get(user.id) as { total: number };
    if (total >= MAX_FRIENDS) throw new Failure(409, "too_many_friends");

    const [low, high] = pairOf(user.id, target.id);
    db.prepare(
      "INSERT INTO friendships (low, high, requester, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    ).run(low, high, user.id, Date.now());
    return c.json({ relation: "outgoing" }, 201);
  });

  function accept(userId: string, otherId: string): void {
    const [low, high] = pairOf(userId, otherId);
    const { changes } = db
      .prepare(
        "UPDATE friendships SET status = 'accepted', created_at = ? WHERE low = ? AND high = ? AND status = 'pending' AND requester = ?",
      )
      .run(Date.now(), low, high, otherId);
    if (!changes) throw new Failure(404, "no_such_request");
  }

  account.post("/friends/:id/accept", (c) => {
    accept(c.get("user").id, c.req.param("id"));
    return c.json({ relation: "friends" });
  });

  /** Removes a friend, declines a request or takes one back. */
  account.delete("/friends/:id", (c) => {
    const [low, high] = pairOf(c.get("user").id, c.req.param("id"));
    db.prepare("DELETE FROM friendships WHERE low = ? AND high = ?").run(low, high);
    return c.body(null, 204);
  });

  // ── What is waiting for the player ────────────────────────────────────────

  /** Friend requests, unread direct messages and party invitations. Cheap: pages poll it. */
  account.get("/pulse", (c) => {
    const user = c.get("user");
    const now = Date.now();
    const { requests } = db
      .prepare(
        "SELECT COUNT(*) AS requests FROM friendships WHERE (low = ?1 OR high = ?1) AND status = 'pending' AND requester <> ?1",
      )
      .get(user.id) as { requests: number };
    const unread = db
      .prepare(
        `SELECT m.user_id AS userId, COUNT(*) AS count
           FROM messages m LEFT JOIN chat_reads r ON r.user_id = m.to_id AND r.channel = m.channel
          WHERE m.to_id = ? AND m.id > COALESCE(r.last_id, 0)
          GROUP BY m.user_id`,
      )
      .all(user.id) as { userId: string; count: number }[];
    const invites = db
      .prepare(
        `SELECT p.code, p.name, ${PUBLIC_COLUMNS}
           FROM party_invites i JOIN parties p ON p.id = i.party_id JOIN users u ON u.id = i.from_id
          WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 10`,
      )
      .all(user.id) as (PublicRow & { code: string; name: string })[];
    return c.json({
      day: { earliest: earliestDay(now), latest: latestDay(now) },
      requests,
      unread,
      invites: invites.map((row) => ({ code: row.code, name: row.name, from: toPublic(row, now) })),
    });
  });
}
