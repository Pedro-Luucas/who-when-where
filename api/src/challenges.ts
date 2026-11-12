import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Hono } from "hono";
import { Failure, transaction, type Deps, type Env } from "./http.ts";
import { notify } from "./notify.ts";
import { PUBLIC_COLUMNS, areFriends, publicById, relationOf, requireUsername, toPublic, type PublicRow, type PublicUser } from "./people.ts";
import type { Pusher } from "./push.ts";
import { LIMITS } from "./rate-limit.ts";
import {
  Invalid,
  readPartySettings,
  readSeed,
  readStageResults,
  readUsername,
  stageCount,
  storedPartySettings,
  type PartySettings,
  type StageResult,
} from "./validate.ts";

// Challenges: an expedition someone played (its seed and settings, so the
// same puzzles are dealt), stored with their score, behind a short link
// (/c/<id>). Anyone with the link plays the same puzzles; a challenge can
// also be sent to one friend, as a duel. Scores are taken on trust, like the
// leaderboards' (see docs/AUDIT_AND_PLAN.md §7.4).

/** Scores shown on a challenge's page. */
const ENTRIES_SHOWN = 50;
const LISTED = 20;

const newId = () => randomBytes(8).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);

type ChallengeRow = {
  id: string;
  from_id: string;
  to_id: string | null;
  reply_to: string | null;
  seed: string;
  settings: string;
  created_at: number;
};

export type Entry = { user: PublicUser; points: number; results: StageResult[]; at: number };

export type ChallengeView = {
  id: string;
  from: PublicUser;
  /** The friend a duel was sent to. */
  to: PublicUser | null;
  replyTo: string | null;
  seed: string;
  settings: PartySettings;
  stages: number;
  createdAt: number;
  /** Best first. */
  entries: Entry[];
  /** How many have played it. */
  players: number;
  /** The viewer's own score, when they have played it. */
  mine: Entry | null;
  /** How the viewer stands with the sender; null for visitors. */
  relation: ReturnType<typeof relationOf> | null;
};

export function describeChallenge(db: DatabaseSync, id: string, viewerId: string | null): ChallengeView {
  const row = db.prepare("SELECT * FROM challenges WHERE id = ?").get(id) as ChallengeRow | undefined;
  if (!row) throw new Failure(404, "no_such_challenge");
  const now = Date.now();
  const from = publicById(db, row.from_id);
  if (!from) throw new Failure(404, "no_such_challenge");
  const to = row.to_id ? publicById(db, row.to_id) : undefined;

  type EntryRow = PublicRow & { points: number; results: string; entry_at: number };
  const toEntry = (entry: EntryRow): Entry => ({
    user: toPublic(entry, now),
    points: entry.points,
    results: JSON.parse(entry.results) as StageResult[],
    at: entry.entry_at,
  });
  const entries = (
    db
      .prepare(
        `SELECT e.points, e.results, e.created_at AS entry_at, ${PUBLIC_COLUMNS}
           FROM challenge_entries e JOIN users u ON u.id = e.user_id
          WHERE e.challenge_id = ? ORDER BY e.points DESC, e.created_at ASC LIMIT ${ENTRIES_SHOWN}`,
      )
      .all(id) as EntryRow[]
  ).map(toEntry);
  const { players } = db.prepare("SELECT COUNT(*) AS players FROM challenge_entries WHERE challenge_id = ?").get(id) as {
    players: number;
  };
  const mine = viewerId
    ? (db
        .prepare(
          `SELECT e.points, e.results, e.created_at AS entry_at, ${PUBLIC_COLUMNS}
             FROM challenge_entries e JOIN users u ON u.id = e.user_id WHERE e.challenge_id = ? AND e.user_id = ?`,
        )
        .get(id, viewerId) as EntryRow | undefined)
    : undefined;
  const settings = storedPartySettings(row.settings);

  return {
    id: row.id,
    from: toPublic(from, now),
    to: to ? toPublic(to, now) : null,
    replyTo: row.reply_to,
    seed: row.seed,
    settings,
    stages: stageCount(settings),
    createdAt: row.created_at,
    entries,
    players,
    mine: mine ? toEntry(mine) : null,
    relation: viewerId ? relationOf(db, viewerId, row.from_id) : null,
  };
}

const total = (results: StageResult[]) => results.reduce((sum, result) => sum + result.points, 0);

/** Anyone may look at a challenge: the link is the invitation. */
export function registerPublicChallenges(app: Hono<Env>, { db, viewer }: Deps): void {
  app.get("/challenges/:id", (c) => c.json({ challenge: describeChallenge(db, c.req.param("id"), viewer(c)?.id ?? null) }));
}

export function registerChallenges(account: Hono<Env>, { db, limit, body }: Deps, pusher: Pusher): void {
  /**
   * Stores a finished expedition as a challenge, with the sender's score.
   * `to` (a friend's username) makes it a duel; `replyTo` marks a rematch.
   */
  account.post("/challenges", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`challenges:${user.id}`, LIMITS.challengesPerUser);
    const input = await body(c);
    const seed = readSeed(input.seed);
    const settings = readPartySettings(input.settings);
    const results = readStageResults(input.results);
    if (results.length !== stageCount(settings)) throw new Invalid("results");

    let toId: string | null = null;
    if (input.to !== undefined && input.to !== null) {
      const target = db.prepare("SELECT id FROM users WHERE username = ?").get(readUsername(input.to, "to")) as
        | { id: string }
        | undefined;
      if (!target) throw new Failure(404, "no_such_player");
      if (target.id === user.id) throw new Failure(400, "self");
      if (!areFriends(db, user.id, target.id)) throw new Failure(403, "not_friends");
      toId = target.id;
    }
    let replyTo: string | null = null;
    if (typeof input.replyTo === "string") {
      replyTo = (db.prepare("SELECT id FROM challenges WHERE id = ?").get(input.replyTo) as { id: string } | undefined)?.id ?? null;
    }

    const id = newId();
    const now = Date.now();
    const points = total(results);
    transaction(db, () => {
      db.prepare(
        "INSERT INTO challenges (id, from_id, to_id, reply_to, seed, settings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(id, user.id, toId, replyTo, seed, JSON.stringify(settings), now);
      db.prepare(
        "INSERT INTO challenge_entries (challenge_id, user_id, points, results, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(id, user.id, points, JSON.stringify(results), now);
    });
    if (toId) notify(db, pusher, toId, "challenge", user.id, { ref: id, points });
    return c.json({ challenge: describeChallenge(db, id, user.id) }, 201);
  });

  /** Plays a challenge: the first score a player sends stands. */
  account.post("/challenges/:id/entries", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`entries:${user.id}`, LIMITS.entriesPerUser);
    const id = c.req.param("id");
    const row = db.prepare("SELECT from_id, settings FROM challenges WHERE id = ?").get(id) as
      | { from_id: string; settings: string }
      | undefined;
    if (!row) throw new Failure(404, "no_such_challenge");
    const results = readStageResults((await body(c)).results);
    if (results.length !== stageCount(storedPartySettings(row.settings))) throw new Invalid("results");
    const points = total(results);
    const { changes } = db
      .prepare(
        "INSERT OR IGNORE INTO challenge_entries (challenge_id, user_id, points, results, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, user.id, points, JSON.stringify(results), Date.now());
    if (changes) notify(db, pusher, row.from_id, "challenge_played", user.id, { ref: id, points });
    return c.json({ challenge: describeChallenge(db, id, user.id) });
  });

  /** The player's recent challenges: sent, received and played. */
  account.get("/challenges", (c) => {
    const user = c.get("user");
    const now = Date.now();
    const rows = db
      .prepare(
        `SELECT c.id AS challenge_id, c.created_at, c.to_id, c.from_id,
                (SELECT COUNT(*) FROM challenge_entries e WHERE e.challenge_id = c.id) AS players,
                (SELECT points FROM challenge_entries e WHERE e.challenge_id = c.id AND e.user_id = ?1) AS mine,
                (SELECT MAX(points) FROM challenge_entries e WHERE e.challenge_id = c.id) AS best,
                ${PUBLIC_COLUMNS}
           FROM challenges c JOIN users u ON u.id = c.from_id
          WHERE c.from_id = ?1 OR c.to_id = ?1
             OR c.id IN (SELECT challenge_id FROM challenge_entries WHERE user_id = ?1)
          ORDER BY c.created_at DESC LIMIT ${LISTED}`,
      )
      .all(user.id) as (PublicRow & {
      created_at: number;
      to_id: string | null;
      from_id: string;
      players: number;
      mine: number | null;
      best: number;
      challenge_id: string;
    })[];
    return c.json({
      challenges: rows.map((row) => {
        const to = row.to_id ? publicById(db, row.to_id) : undefined;
        return {
          id: row.challenge_id,
          from: toPublic(row, now),
          to: to ? toPublic(to, now) : null,
          createdAt: row.created_at,
          players: row.players,
          mine: row.mine,
          best: row.best,
        };
      }),
    });
  });
}
