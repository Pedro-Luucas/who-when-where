import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Hono } from "hono";
import { latestDay, utcDay } from "./days.ts";
import { Failure, isUniqueViolation, transaction, type Deps, type Env } from "./http.ts";
import { notify } from "./notify.ts";
import {
  PUBLIC_COLUMNS,
  areFriends,
  placeholders,
  requireUsername,
  toPublic,
  type PublicRow,
  type PublicUser,
} from "./people.ts";
import type { Pusher } from "./push.ts";
import { LIMITS } from "./rate-limit.ts";
import { Invalid, inChallengeSql, isGame, readChoice, readLine, readUsername } from "./validate.ts";

// Nudges, reactions and clubs. A nudge is one tap a day that lands in the
// friend's inbox. A reaction is one mark on their day, replaced by the next
// tap. A club is a small group with today's scores added up from results.

const CLUB_MEMBERS = 20;
const NAME_MAX = 32;
const REACTIONS_SHOWN = 400;

const EMOJI = ["pin", "fire", "clap", "mind"] as const;
type Emoji = (typeof EMOJI)[number];

type ClubRow = { id: string; slug: string; name: string; owner_id: string; created_at: number };

function readDayQuery(value: string | undefined, now: number): number {
  if (value === undefined) return utcDay(now);
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > latestDay(now)) throw new Invalid("day");
  return day;
}

function readUserId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) throw new Invalid("userId");
  return value;
}

function readClubName(value: unknown): string {
  const name = readLine(value, NAME_MAX, "name");
  if ([...name].length < 3) throw new Invalid("name");
  return name;
}

/** A URL piece from the name: letters and digits, at least three. */
function slugBase(name: string): string {
  const folded = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  let slug = folded.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length > 32) slug = slug.slice(0, 32).replace(/-+$/g, "");
  return slug.length >= 3 ? slug : "club";
}

function readSlug(value: string): string {
  const slug = value.toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) throw new Failure(404, "no_such_club");
  return slug;
}

function clubBySlug(db: DatabaseSync, slug: string): ClubRow {
  const club = db.prepare("SELECT id, slug, name, owner_id, created_at FROM clubs WHERE slug = ?").get(slug) as
    | ClubRow
    | undefined;
  if (!club) throw new Failure(404, "no_such_club");
  return club;
}

function memberIds(db: DatabaseSync, clubId: string): string[] {
  return (
    db.prepare("SELECT user_id FROM club_members WHERE club_id = ?").all(clubId) as { user_id: string }[]
  ).map((row) => row.user_id);
}

function requireMember(db: DatabaseSync, clubId: string, userId: string): void {
  const row = db.prepare("SELECT 1 FROM club_members WHERE club_id = ? AND user_id = ?").get(clubId, userId);
  if (!row) throw new Failure(403, "not_in_club");
}

type Scored = { user: PublicUser; role: "owner" | "member"; today: { points: number; puzzles: number } };

function describeClub(db: DatabaseSync, club: ClubRow, day: number): {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  members: Scored[];
} {
  const ids = memberIds(db, club.id);
  const now = Date.now();
  const people = ids.length
    ? (db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id IN (${placeholders(ids.length)})`).all(...ids) as PublicRow[])
    : [];
  const scores = new Map<string, { points: number; puzzles: number }>();
  if (ids.length) {
    const rows = db
      .prepare(
        `SELECT user_id, SUM(points) AS points, COUNT(*) AS puzzles FROM results
          WHERE day = ? AND ${inChallengeSql()} AND user_id IN (${placeholders(ids.length)}) GROUP BY user_id`,
      )
      .all(day, ...ids) as { user_id: string; points: number; puzzles: number }[];
    for (const row of rows) scores.set(row.user_id, { points: row.points, puzzles: row.puzzles });
  }
  const members = people
    .map((row) => ({
      user: toPublic(row, now),
      role: (row.id === club.owner_id ? "owner" : "member") as "owner" | "member",
      today: scores.get(row.id) ?? { points: 0, puzzles: 0 },
    }))
    .sort((a, b) => b.today.points - a.today.points || a.user.name.localeCompare(b.user.name));
  return { id: club.id, slug: club.slug, name: club.name, ownerId: club.owner_id, members };
}

function playedToday(db: DatabaseSync, userId: string, day: number): boolean {
  return !!db
    .prepare(`SELECT 1 AS hit FROM results WHERE user_id = ? AND day = ? AND ${inChallengeSql()} LIMIT 1`)
    .get(userId, day);
}

export function registerCommunity(account: Hono<Env>, { db, limit, body }: Deps, pusher: Pusher): void {
  // ── Nudges ────────────────────────────────────────────────────────────────

  /** Friends the player already nudged on `day` (today, when omitted). */
  account.get("/nudges", (c) => {
    const user = requireUsername(c.get("user"));
    const day = readDayQuery(c.req.query("day"), Date.now());
    const rows = db.prepare("SELECT to_id FROM nudges WHERE from_id = ? AND day = ?").all(user.id, day) as {
      to_id: string;
    }[];
    return c.json({ sent: rows.map((row) => row.to_id) });
  });

  /** One nudge per friend per UTC day. Strangers, yourself, and a second tap are refused. */
  account.post("/nudges", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`nudges:${user.id}`, LIMITS.nudgesPerUser);
    const userId = readUserId((await body(c)).userId);
    if (userId === user.id) throw new Failure(400, "self");
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as { id: string } | undefined;
    if (!target) throw new Failure(404, "no_such_player");
    if (!areFriends(db, user.id, target.id)) throw new Failure(403, "not_friends");
    const day = utcDay();
    const sent = db.prepare("SELECT 1 FROM nudges WHERE from_id = ? AND to_id = ? AND day = ?").get(user.id, target.id, day);
    if (sent) throw new Failure(409, "already_nudged");
    if (playedToday(db, target.id, day)) throw new Failure(409, "already_played");
    try {
      db.prepare("INSERT INTO nudges (from_id, to_id, day, created_at) VALUES (?, ?, ?, ?)").run(
        user.id,
        target.id,
        day,
        Date.now(),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new Failure(409, "already_nudged");
      throw error;
    }
    notify(db, pusher, target.id, "nudge", user.id);
    return c.body(null, 204);
  });

  // ── Reactions ─────────────────────────────────────────────────────────────

  /** Reactions on the player and their friends for `day`, newest first. */
  account.get("/reactions", (c) => {
    const user = requireUsername(c.get("user"));
    const day = readDayQuery(c.req.query("day"), Date.now());
    const now = Date.now();
    const rows = db
      .prepare(
        `SELECT r.to_id, r.game, r.emoji, r.created_at, ${PUBLIC_COLUMNS}
           FROM reactions r JOIN users u ON u.id = r.from_id
          WHERE r.day = ?
            AND (r.to_id = ? OR EXISTS (
              SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                AND f.low = MIN(r.to_id, ?) AND f.high = MAX(r.to_id, ?)))
          ORDER BY r.created_at DESC LIMIT ${REACTIONS_SHOWN}`,
      )
      .all(day, user.id, user.id, user.id) as (PublicRow & {
      to_id: string;
      game: string;
      emoji: string;
      created_at: number;
    })[];
    return c.json({
      reactions: rows.flatMap((row) => {
        if (!EMOJI.includes(row.emoji as Emoji)) return [];
        return [{ toId: row.to_id, game: row.game, emoji: row.emoji as Emoji, at: row.created_at, from: toPublic(row, now) }];
      }),
    });
  });

  /** Sets the player's reaction on a friend for today. A second tap replaces it. */
  account.put("/reactions", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`reactions:${user.id}`, LIMITS.reactionsPerUser);
    const input = await body(c);
    const userId = readUserId(input.userId);
    const emoji = readChoice(input.emoji, EMOJI, "emoji");
    const game = input.game === undefined || input.game === "all" ? "all" : input.game;
    if (game !== "all" && !isGame(game)) throw new Invalid("game");
    if (userId === user.id) throw new Failure(400, "self");
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as { id: string } | undefined;
    if (!target) throw new Failure(404, "no_such_player");
    if (!areFriends(db, user.id, target.id)) throw new Failure(403, "not_friends");
    const day = utcDay();
    db.prepare(
      `INSERT INTO reactions (from_id, to_id, day, game, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (from_id, to_id, day, game) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`,
    ).run(user.id, target.id, day, game, emoji, Date.now());
    return c.json({ emoji, game });
  });

  // ── Clubs ─────────────────────────────────────────────────────────────────

  /** Clubs the player belongs to. The one they own comes first. */
  account.get("/clubs", (c) => {
    const user = requireUsername(c.get("user"));
    const rows = db
      .prepare(
        `SELECT c.slug, c.name, c.owner_id,
                (SELECT COUNT(*) FROM club_members m WHERE m.club_id = c.id) AS members
           FROM clubs c JOIN club_members mine ON mine.club_id = c.id AND mine.user_id = ?1
          ORDER BY c.owner_id = ?1 DESC, lower(c.name)`,
      )
      .all(user.id) as { slug: string; name: string; owner_id: string; members: number }[];
    return c.json({
      clubs: rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        ownerId: row.owner_id,
        members: row.members,
        role: row.owner_id === user.id ? ("owner" as const) : ("member" as const),
      })),
    });
  });

  /** Opens the one club this player owns. */
  account.post("/clubs", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`clubs:${user.id}`, LIMITS.clubsPerUser);
    const name = readClubName((await body(c)).name);
    if (db.prepare("SELECT 1 FROM clubs WHERE owner_id = ?").get(user.id)) throw new Failure(409, "club_exists");
    const id = randomUUID();
    const now = Date.now();
    const base = slugBase(name);
    let slug = base;
    for (let n = 0; n < 20; n++) {
      slug = n === 0 ? base : `${base}-${n + 1}`;
      try {
        transaction(db, () => {
          db.prepare("INSERT INTO clubs (id, slug, name, owner_id, created_at) VALUES (?, ?, ?, ?, ?)").run(
            id,
            slug,
            name,
            user.id,
            now,
          );
          db.prepare("INSERT INTO club_members (club_id, user_id, created_at) VALUES (?, ?, ?)").run(id, user.id, now);
        });
        return c.json({ club: describeClub(db, clubBySlug(db, slug), utcDay(now)) }, 201);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        if (error instanceof Error && error.message.includes("owner_id")) throw new Failure(409, "club_exists");
      }
    }
    throw new Failure(409, "club_exists");
  });

  /** The club and today's scores, for a member. */
  account.get("/clubs/:slug", (c) => {
    const user = requireUsername(c.get("user"));
    const club = clubBySlug(db, readSlug(c.req.param("slug")));
    requireMember(db, club.id, user.id);
    const day = readDayQuery(c.req.query("day"), Date.now());
    return c.json({ club: describeClub(db, club, day) });
  });

  /** The owner adds a real player, up to 20 members. */
  account.post("/clubs/:slug/members", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`clubs:${user.id}`, LIMITS.clubsPerUser);
    const club = clubBySlug(db, readSlug(c.req.param("slug")));
    if (club.owner_id !== user.id) throw new Failure(403, "not_host");
    const username = readUsername((await body(c)).username);
    const target = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: string } | undefined;
    if (!target) throw new Failure(404, "no_such_player");
    if (target.id === user.id) throw new Failure(400, "self");
    const already = db.prepare("SELECT 1 FROM club_members WHERE club_id = ? AND user_id = ?").get(club.id, target.id);
    if (!already) {
      const { total } = db.prepare("SELECT COUNT(*) AS total FROM club_members WHERE club_id = ?").get(club.id) as {
        total: number;
      };
      if (total >= CLUB_MEMBERS) throw new Failure(409, "club_full");
      db.prepare("INSERT INTO club_members (club_id, user_id, created_at) VALUES (?, ?, ?)").run(
        club.id,
        target.id,
        Date.now(),
      );
    }
    return c.json({ club: describeClub(db, club, utcDay()) });
  });

  /** The owner removes a member. */
  account.delete("/clubs/:slug/members/:userId", (c) => {
    const user = requireUsername(c.get("user"));
    limit(`clubs:${user.id}`, LIMITS.clubsPerUser);
    const club = clubBySlug(db, readSlug(c.req.param("slug")));
    if (club.owner_id !== user.id) throw new Failure(403, "not_host");
    const userId = c.req.param("userId");
    if (userId === user.id) throw new Failure(400, "self");
    const { changes } = db.prepare("DELETE FROM club_members WHERE club_id = ? AND user_id = ?").run(club.id, userId);
    if (!changes) throw new Failure(404, "no_such_player");
    return c.body(null, 204);
  });

  /** A member leaves. The owner stays, so the club keeps someone in charge. */
  account.post("/clubs/:slug/leave", (c) => {
    const user = requireUsername(c.get("user"));
    limit(`clubs:${user.id}`, LIMITS.clubsPerUser);
    const club = clubBySlug(db, readSlug(c.req.param("slug")));
    if (club.owner_id === user.id) throw new Failure(403, "club_owner");
    const { changes } = db.prepare("DELETE FROM club_members WHERE club_id = ? AND user_id = ?").run(club.id, user.id);
    if (!changes) throw new Failure(403, "not_in_club");
    return c.body(null, 204);
  });
}
