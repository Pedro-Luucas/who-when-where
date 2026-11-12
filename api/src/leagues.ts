import type { DatabaseSync } from "node:sqlite";
import type { Hono } from "hono";
import { currentWeek, weekDays, weekEndsAt } from "./days.ts";
import { Failure, type Deps, type Env } from "./http.ts";
import { PUBLIC_COLUMNS, requireUsername, toPublic, type PublicRow } from "./people.ts";
import { LIMITS } from "./rate-limit.ts";
import { Invalid, readInteger, readStageResults, type StageResult } from "./validate.ts";

// Weekly leagues and the Weekly Special.
//
// Leagues: the first time in a week a player scores a daily, they are put in
// a group of up to GROUP_SIZE players at their tier. Every point from the
// week's dailies (any game) counts. When the week is over, the top of each
// group goes up a tier and the bottom goes down, which is settled the next
// time the player joins a week. Groups fill in the order players arrive, so
// a group is made of players who started their week at about the same time.
//
// The Weekly Special: one expedition per week, the same for everybody (the
// site deals it from the week number), played once; its own board.

export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export const GROUP_SIZE = 30;
const MAX_ZONE = 5;
const BOARD_SIZE = 50;

/** How many go up and down from a group of `size` at `tier`. */
export function zonesOf(size: number, tier: number): { promote: number; demote: number } {
  const promote = tier >= TIERS.length - 1 || size < 1 ? 0 : Math.min(MAX_ZONE, Math.max(1, Math.ceil(size * 0.2)));
  const demote = tier <= 0 || size < 5 ? 0 : Math.min(MAX_ZONE, Math.floor(size * 0.2));
  return { promote, demote: Math.min(demote, size - promote) };
}

type Standing = PublicRow & { points: number; puzzles: number; joined_at: number };

/** A group's table, best first: week points, then who joined first. */
function standings(db: DatabaseSync, week: number, tier: number, group: number): Standing[] {
  const { first, last } = weekDays(week);
  return db
    .prepare(
      `SELECT m.joined_at, COALESCE(SUM(r.points), 0) AS points, COUNT(r.day) AS puzzles, ${PUBLIC_COLUMNS}
         FROM league_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN results r ON r.user_id = m.user_id AND r.day BETWEEN ? AND ?
        WHERE m.week = ? AND m.tier = ? AND m.grp = ?
        GROUP BY m.user_id
        ORDER BY points DESC, m.joined_at ASC, u.username ASC`,
    )
    .all(first, last, week, tier, group) as Standing[];
}

type Membership = { week: number; tier: number; grp: number };

/** How a finished week went for a player: where they ended and what it did to their tier. */
function outcomeOf(db: DatabaseSync, userId: string, membership: Membership) {
  const table = standings(db, membership.week, membership.tier, membership.grp);
  const index = table.findIndex((row) => row.id === userId);
  const { promote, demote } = zonesOf(table.length, membership.tier);
  const outcome = index < 0 ? "stay" : index < promote ? "up" : index >= table.length - demote ? "down" : "stay";
  const tier = outcome === "up" ? membership.tier + 1 : outcome === "down" ? membership.tier - 1 : membership.tier;
  return { week: membership.week, tier: membership.tier, rank: index + 1, size: table.length, outcome, newTier: tier };
}

/** The tier a player last played at (0 for a newcomer). */
const storedTier = (db: DatabaseSync, userId: string): number =>
  (db.prepare("SELECT league_tier FROM users WHERE id = ?").get(userId) as { league_tier: number } | undefined)?.league_tier ?? 0;

/** Puts a player in this week's league, if they are not in it yet. Returns their membership. */
export function joinLeague(db: DatabaseSync, userId: string, now = Date.now()): Membership {
  const week = currentWeek(now);
  const existing = db.prepare("SELECT week, tier, grp FROM league_members WHERE week = ? AND user_id = ?").get(week, userId) as
    | Membership
    | undefined;
  if (existing) return existing;

  // Settle the last week they played: up, down or the same.
  const previous = db
    .prepare("SELECT week, tier, grp FROM league_members WHERE user_id = ? AND week < ? ORDER BY week DESC LIMIT 1")
    .get(userId, week) as Membership | undefined;
  const tier = previous ? outcomeOf(db, userId, previous).newTier : storedTier(db, userId);

  const open = db
    .prepare(
      `SELECT grp FROM league_members WHERE week = ? AND tier = ? GROUP BY grp HAVING COUNT(*) < ${GROUP_SIZE} ORDER BY grp LIMIT 1`,
    )
    .get(week, tier) as { grp: number } | undefined;
  const group =
    open?.grp ??
    ((db.prepare("SELECT MAX(grp) AS top FROM league_members WHERE week = ? AND tier = ?").get(week, tier) as { top: number | null })
      .top ?? 0) + 1;

  db.prepare("INSERT OR IGNORE INTO league_members (week, user_id, tier, grp, joined_at) VALUES (?, ?, ?, ?, ?)").run(
    week,
    userId,
    tier,
    group,
    now,
  );
  db.prepare("UPDATE users SET league_tier = ? WHERE id = ?").run(tier, userId);
  return { week, tier, grp: group };
}

/** Called after scores arrive: a player who scored a daily this week takes part in its league. */
export function joinLeagueIfPlayed(db: DatabaseSync, userId: string, now = Date.now()): void {
  const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as { username: string | null } | undefined;
  if (!user?.username) return; // a league is a public table: it needs a handle
  const { first, last } = weekDays(currentWeek(now));
  if (db.prepare("SELECT 1 FROM results WHERE user_id = ? AND day BETWEEN ? AND ? LIMIT 1").get(userId, first, last)) {
    joinLeague(db, userId, now);
  }
}

export function registerLeagues(app: Hono<Env>, account: Hono<Env>, { db, limit, body, viewer }: Deps): void {
  /** The player's league this week: their group's table, the zones, and how last week ended. */
  account.get("/league", (c) => {
    const user = c.get("user");
    const now = Date.now();
    const week = currentWeek(now);
    joinLeagueIfPlayed(db, user.id, now);
    const membership = db.prepare("SELECT week, tier, grp FROM league_members WHERE week = ? AND user_id = ?").get(week, user.id) as
      | Membership
      | undefined;
    const previous = db
      .prepare("SELECT week, tier, grp FROM league_members WHERE user_id = ? AND week < ? ORDER BY week DESC LIMIT 1")
      .get(user.id, week) as Membership | undefined;
    const tier = membership?.tier ?? (previous ? outcomeOf(db, user.id, previous).newTier : storedTier(db, user.id));

    let group = null;
    if (membership) {
      const table = standings(db, week, membership.tier, membership.grp);
      const zones = zonesOf(table.length, membership.tier);
      group = {
        number: membership.grp,
        ...zones,
        rows: table.map((row, index) => ({
          rank: index + 1,
          points: row.points,
          puzzles: row.puzzles,
          user: toPublic(row, now),
          zone: index < zones.promote ? "up" : index >= table.length - zones.demote ? "down" : null,
        })),
      };
    }
    return c.json({
      week,
      endsAt: weekEndsAt(week),
      tiers: TIERS,
      tier,
      group,
      last: previous && previous.week === week - 1 ? outcomeOf(db, user.id, previous) : null,
    });
  });

  // ── The Weekly Special ────────────────────────────────────────────────────

  /** This week's Special board (or a past week's): the best scores, and the viewer's. */
  app.get("/weekly", (c) => {
    const now = Date.now();
    const thisWeek = currentWeek(now);
    const query = c.req.query("week");
    const week = query === undefined ? thisWeek : Number(query);
    if (!Number.isInteger(week) || week < 1 || week > thisWeek) throw new Invalid("week");
    type Row = PublicRow & { points: number };
    const top = db
      .prepare(
        `SELECT w.points, ${PUBLIC_COLUMNS} FROM weekly_results w JOIN users u ON u.id = w.user_id
          WHERE w.week = ? ORDER BY w.points DESC, w.created_at ASC LIMIT ${BOARD_SIZE}`,
      )
      .all(week) as Row[];
    let rank = 0;
    const rows = top.map((row, i) => {
      if (i === 0 || row.points < top[i - 1].points) rank = i + 1;
      return { rank, points: row.points, user: toPublic(row, now) };
    });
    const { players } = db.prepare("SELECT COUNT(*) AS players FROM weekly_results WHERE week = ?").get(week) as { players: number };
    const me = viewer(c);
    let mine: { rank: number; points: number; results: StageResult[] } | null = null;
    if (me) {
      const own = db.prepare("SELECT points, results FROM weekly_results WHERE week = ? AND user_id = ?").get(week, me.id) as
        | { points: number; results: string }
        | undefined;
      if (own) {
        const { ahead } = db
          .prepare("SELECT COUNT(*) AS ahead FROM weekly_results WHERE week = ? AND points > ?")
          .get(week, own.points) as { ahead: number };
        mine = { rank: ahead + 1, points: own.points, results: JSON.parse(own.results) as StageResult[] };
      }
    }
    return c.json({ week, endsAt: weekEndsAt(week), players, rows, me: mine });
  });

  /** Sends this week's Special score. Only this week's; the first one stands. */
  account.put("/weekly", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`entries:${user.id}`, LIMITS.entriesPerUser);
    const input = await body(c);
    const now = Date.now();
    const week = readInteger(input.week, 1, currentWeek(now), "week");
    if (week !== currentWeek(now)) throw new Failure(409, "week_over");
    const results = readStageResults(input.results);
    const points = results.reduce((sum, result) => sum + result.points, 0);
    db.prepare("INSERT OR IGNORE INTO weekly_results (week, user_id, points, results, created_at) VALUES (?, ?, ?, ?, ?)").run(
      week,
      user.id,
      points,
      JSON.stringify(results),
      now,
    );
    return c.body(null, 204);
  });
}
