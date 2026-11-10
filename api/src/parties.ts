import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Hono } from "hono";
import { listMessages, partyChannel, postMessage, readAfter } from "./chat.ts";
import { Failure, isUniqueViolation, transaction, type Deps, type Env } from "./http.ts";
import { PUBLIC_COLUMNS, areFriends, requireUsername, toPublic, type PublicRow } from "./people.ts";
import { LIMITS } from "./rate-limit.ts";
import {
  Invalid,
  MAX_POINTS,
  PARTY_NAME_MAX,
  asObject,
  readChoice,
  readInteger,
  readLine,
  readPartySettings,
  stageCount,
  type PartySettings,
} from "./validate.ts";

// A party is a room where a group plays the same expedition: a run of
// puzzles from every game, one after the other. The server keeps the room,
// its settings and everyone's scores; each player's page deals the puzzles
// from the run's seed and plays them, so the server never needs the answers.
// Pages poll the room every couple of seconds.

export const MAX_MEMBERS = 12;
/** A member whose page stopped polling this long ago is away. */
const AWAY_MS = 15_000;
/** Rooms nobody has looked at for this long are closed. */
const STALE_MS = 6 * 60 * 60 * 1000;
/** A public room is listed while someone was in it this recently. */
const LISTED_MS = 60_000;
const LIST_SIZE = 30;

const VISIBILITIES = ["public", "private"] as const;
// No 0/O, 1/I/L: codes get read aloud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

type PartyRow = {
  id: string;
  code: string;
  host_id: string;
  name: string;
  visibility: (typeof VISIBILITIES)[number];
  settings: string;
  status: "lobby" | "playing";
  run: number;
  seed: string;
  started_at: number;
  released: number;
};

type MemberRow = PublicRow & { joined_at: number; seen: number };

const newCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

function deleteParty(db: DatabaseSync, id: string): void {
  db.prepare("DELETE FROM messages WHERE channel = ?").run(partyChannel(id));
  db.prepare("DELETE FROM parties WHERE id = ?").run(id); // members, scores and invitations cascade
}

/** Closes rooms everyone has left open and walked away from; call now and then. */
export function deleteStaleParties(db: DatabaseSync, now = Date.now()): void {
  const stale = db
    .prepare(
      `SELECT p.id FROM parties p
        WHERE NOT EXISTS (SELECT 1 FROM party_members m WHERE m.party_id = p.id AND m.last_seen > ?)`,
    )
    .all(now - STALE_MS) as { id: string }[];
  for (const { id } of stale) deleteParty(db, id);
}

export function registerParties(account: Hono<Env>, { db, limit, body }: Deps): void {
  function partyByCode(code: string): PartyRow {
    const party = db.prepare("SELECT * FROM parties WHERE code = ?").get(code.toUpperCase()) as PartyRow | undefined;
    if (!party) throw new Failure(404, "no_such_party");
    return party;
  }

  const membership = (partyId: string, userId: string) =>
    db.prepare("SELECT joined_at, last_seen FROM party_members WHERE party_id = ? AND user_id = ?").get(partyId, userId) as
      | { joined_at: number; last_seen: number }
      | undefined;

  /** The party, for one of its members. */
  function partyFor(code: string, userId: string): PartyRow & { joinedAt: number } {
    const party = partyByCode(code);
    const member = membership(party.id, userId);
    if (!member) throw new Failure(403, "not_member");
    return { ...party, joinedAt: member.joined_at };
  }

  function partyForHost(code: string, userId: string): PartyRow {
    const party = partyFor(code, userId);
    if (party.host_id !== userId) throw new Failure(403, "not_host");
    return party;
  }

  const memberCount = (partyId: string): number =>
    (db.prepare("SELECT COUNT(*) AS total FROM party_members WHERE party_id = ?").get(partyId) as { total: number })
      .total;

  /** Everything a member's page shows: the room, who is in it, the scores and new chat. */
  function describe(party: PartyRow, userId: string, after: number | undefined) {
    const now = Date.now();
    const members = db
      .prepare(
        `SELECT pm.joined_at, pm.last_seen AS seen, ${PUBLIC_COLUMNS}
           FROM party_members pm JOIN users u ON u.id = pm.user_id
          WHERE pm.party_id = ? ORDER BY pm.joined_at, u.id`,
      )
      .all(party.id) as MemberRow[];
    const results = db
      .prepare("SELECT user_id, points, detail FROM party_results WHERE party_id = ? AND run = ? ORDER BY stage")
      .all(party.id, party.run) as { user_id: string; points: number; detail: string }[];

    return {
      you: userId,
      party: {
        code: party.code,
        name: party.name,
        hostId: party.host_id,
        visibility: party.visibility,
        settings: JSON.parse(party.settings) as PartySettings,
        status: party.status,
        run: party.run,
        seed: party.seed,
        startedAt: party.started_at,
        released: party.released,
      },
      members: members.map((member) => ({
        user: toPublic(member, now),
        /** Their page is open on the room right now. */
        here: now - member.seen < AWAY_MS,
        /** Came in after the run began: watching until the next one. */
        spectator: party.status === "playing" && member.joined_at > party.started_at,
        /** One score per puzzle finished in this run, in order. */
        results: results
          .filter((result) => result.user_id === member.id)
          .map(({ points, detail }) => ({ points, detail })),
      })),
      messages: listMessages(db, partyChannel(party.id), after),
    };
  }

  function summaries(where: string, ...params: (string | number)[]) {
    const rows = db
      .prepare(
        `SELECT p.code, p.name, p.status, p.visibility, p.settings,
                (SELECT COUNT(*) FROM party_members m WHERE m.party_id = p.id) AS players, ${PUBLIC_COLUMNS}
           FROM parties p JOIN users u ON u.id = p.host_id
          WHERE ${where}
          ORDER BY p.status = 'lobby' DESC, p.created_at DESC LIMIT ${LIST_SIZE}`,
      )
      .all(...params) as (PublicRow & {
      code: string;
      name: string;
      status: string;
      visibility: string;
      settings: string;
      players: number;
    })[];
    const now = Date.now();
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      status: row.status,
      visibility: row.visibility,
      players: row.players,
      stages: stageCount(JSON.parse(row.settings) as PartySettings),
      host: toPublic(row, now),
    }));
  }

  /** The rooms the player is in, and the public ones that are open now. */
  account.get("/parties", (c) => {
    const user = c.get("user");
    return c.json({
      mine: summaries("EXISTS (SELECT 1 FROM party_members m WHERE m.party_id = p.id AND m.user_id = ?)", user.id),
      open: summaries(
        `p.visibility = 'public'
         AND NOT EXISTS (SELECT 1 FROM party_members m WHERE m.party_id = p.id AND m.user_id = ?)
         AND EXISTS (SELECT 1 FROM party_members m WHERE m.party_id = p.id AND m.last_seen > ?)
         AND (SELECT COUNT(*) FROM party_members m WHERE m.party_id = p.id) < ${MAX_MEMBERS}`,
        user.id,
        Date.now() - LISTED_MS,
      ),
    });
  });

  /** Opens a room, with the player as its host. */
  account.post("/parties", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`parties:${user.id}`, LIMITS.partiesPerUser);
    const input = await body(c);
    const name = input.name === undefined ? "" : readLine(input.name, PARTY_NAME_MAX, "name", true);
    const settings = readPartySettings(input.settings);
    const visibility = readChoice(input.visibility ?? "private", VISIBILITIES, "visibility");

    const now = Date.now();
    const id = randomUUID();
    for (let attempt = 0; ; attempt++) {
      const code = newCode();
      try {
        transaction(db, () => {
          // A host who opens a new room leaves the ones they were alone in.
          const alone = db
            .prepare(
              `SELECT p.id FROM parties p WHERE p.host_id = ?
                  AND (SELECT COUNT(*) FROM party_members m WHERE m.party_id = p.id) <= 1`,
            )
            .all(user.id) as { id: string }[];
          for (const old of alone) deleteParty(db, old.id);

          db.prepare(
            `INSERT INTO parties (id, code, host_id, name, visibility, settings, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'lobby', ?, ?)`,
          ).run(id, code, user.id, name, visibility, JSON.stringify(settings), now, now);
          db.prepare("INSERT INTO party_members (party_id, user_id, joined_at, last_seen) VALUES (?, ?, ?, ?)").run(
            id,
            user.id,
            now,
            now,
          );
        });
        return c.json(describe(partyByCode(code), user.id, undefined), 201);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= 5) throw error; // the code was taken: draw another
      }
    }
  });

  /** Enters a room by its code. Entering one the player is already in changes nothing. */
  account.post("/parties/join", async (c) => {
    const user = requireUsername(c.get("user"));
    const code = (await body(c)).code;
    if (typeof code !== "string" || code.length > 16) throw new Invalid("code");
    const party = partyByCode(code.trim());

    const now = Date.now();
    if (!membership(party.id, user.id)) {
      if (memberCount(party.id) >= MAX_MEMBERS) throw new Failure(409, "party_full");
      db.prepare("INSERT INTO party_members (party_id, user_id, joined_at, last_seen) VALUES (?, ?, ?, ?)").run(
        party.id,
        user.id,
        now,
        now,
      );
    }
    db.prepare("DELETE FROM party_invites WHERE party_id = ? AND user_id = ?").run(party.id, user.id);
    return c.json(describe(party, user.id, undefined));
  });

  /** The room as it stands, and the chat since `?after=`. Marks the player as here. */
  account.get("/parties/:code", (c) => {
    const user = c.get("user");
    const party = partyFor(c.req.param("code"), user.id);
    db.prepare("UPDATE party_members SET last_seen = ? WHERE party_id = ? AND user_id = ?").run(
      Date.now(),
      party.id,
      user.id,
    );
    return c.json(describe(party, user.id, readAfter(c.req.query("after"))));
  });

  /** The host changes the room between runs. */
  account.patch("/parties/:code", async (c) => {
    const user = c.get("user");
    const party = partyForHost(c.req.param("code"), user.id);
    if (party.status !== "lobby") throw new Failure(409, "in_progress");
    const input = await body(c);
    const name = input.name === undefined ? party.name : readLine(input.name, PARTY_NAME_MAX, "name", true);
    const settings =
      input.settings === undefined ? party.settings : JSON.stringify(readPartySettings(input.settings));
    const visibility =
      input.visibility === undefined ? party.visibility : readChoice(input.visibility, VISIBILITIES, "visibility");
    db.prepare("UPDATE parties SET name = ?, settings = ?, visibility = ?, updated_at = ? WHERE id = ?").run(
      name,
      settings,
      visibility,
      Date.now(),
      party.id,
    );
    return c.json(describe(partyByCode(party.code), user.id, undefined));
  });

  /** The host begins a run: a fresh seed, and everyone in the room plays. */
  account.post("/parties/:code/start", (c) => {
    const user = c.get("user");
    const party = partyForHost(c.req.param("code"), user.id);
    const now = Date.now();
    db.prepare(
      `UPDATE parties SET status = 'playing', run = run + 1, seed = ?, started_at = ?, released = -1, updated_at = ?
        WHERE id = ?`,
    ).run(randomBytes(6).toString("base64url"), now, now, party.id);
    return c.json(describe(partyByCode(party.code), user.id, undefined));
  });

  /** The host brings everyone back to the lobby; the last run's scores stay on show. */
  account.post("/parties/:code/lobby", (c) => {
    const user = c.get("user");
    const party = partyForHost(c.req.param("code"), user.id);
    db.prepare("UPDATE parties SET status = 'lobby', updated_at = ? WHERE id = ?").run(Date.now(), party.id);
    return c.json(describe(partyByCode(party.code), user.id, undefined));
  });

  /** When playing "together", the host stops waiting for whoever has not finished a puzzle. */
  account.post("/parties/:code/release", async (c) => {
    const user = c.get("user");
    const party = partyForHost(c.req.param("code"), user.id);
    const stages = stageCount(JSON.parse(party.settings) as PartySettings);
    const stage = readInteger((await body(c)).stage, 0, stages - 1, "stage");
    db.prepare("UPDATE parties SET released = MAX(released, ?) WHERE id = ?").run(stage, party.id);
    return c.json(describe(partyByCode(party.code), user.id, undefined));
  });

  /** Records the player's score on one puzzle of the run. Puzzles are scored in order, once. */
  account.post("/parties/:code/results", async (c) => {
    const user = c.get("user");
    const party = partyFor(c.req.param("code"), user.id);
    const input = await body(c);
    const stages = stageCount(JSON.parse(party.settings) as PartySettings);
    const run = readInteger(input.run, 1, Number.MAX_SAFE_INTEGER, "run");
    const stage = readInteger(input.stage, 0, stages - 1, "stage");
    const points = readInteger(input.points, 0, MAX_POINTS, "points");
    const detail = input.detail === undefined ? "" : readLine(input.detail, 40, "detail", true);

    if (party.status !== "playing" || run !== party.run) throw new Failure(409, "run_over");
    if (party.joinedAt > party.started_at) throw new Failure(403, "spectator");
    const { done } = db
      .prepare("SELECT COUNT(*) AS done FROM party_results WHERE party_id = ? AND run = ? AND user_id = ?")
      .get(party.id, run, user.id) as { done: number };
    if (stage > done) throw new Failure(409, "out_of_order");
    if (stage === done) {
      db.prepare(
        `INSERT OR IGNORE INTO party_results (party_id, run, user_id, stage, points, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(party.id, run, user.id, stage, points, detail, Date.now());
    }
    return c.body(null, 204);
  });

  account.post("/parties/:code/chat", async (c) => {
    const user = c.get("user");
    const party = partyFor(c.req.param("code"), user.id);
    limit(`chat:${user.id}`, LIMITS.chatPerUser);
    return c.json({ message: postMessage(db, partyChannel(party.id), user.id, (await body(c)).body) }, 201);
  });

  /** Removes a player from the room; an empty room closes, and a room without its host gets a new one. */
  function remove(party: PartyRow, userId: string): void {
    transaction(db, () => {
      db.prepare("DELETE FROM party_members WHERE party_id = ? AND user_id = ?").run(party.id, userId);
      const next = db
        .prepare("SELECT user_id FROM party_members WHERE party_id = ? ORDER BY joined_at, user_id LIMIT 1")
        .get(party.id) as { user_id: string } | undefined;
      if (!next) deleteParty(db, party.id);
      else if (party.host_id === userId) {
        db.prepare("UPDATE parties SET host_id = ? WHERE id = ?").run(next.user_id, party.id);
      }
    });
  }

  account.post("/parties/:code/leave", (c) => {
    const user = c.get("user");
    remove(partyFor(c.req.param("code"), user.id), user.id);
    return c.body(null, 204);
  });

  account.post("/parties/:code/kick", async (c) => {
    const user = c.get("user");
    const party = partyForHost(c.req.param("code"), user.id);
    const target = asObject(await body(c)).userId;
    if (typeof target !== "string" || target === user.id) throw new Invalid("userId");
    remove(party, target);
    return c.json(describe(partyByCode(party.code), user.id, undefined));
  });

  /** A member invites one of their friends; it shows up in the friend's pulse. */
  account.post("/parties/:code/invite", async (c) => {
    const user = c.get("user");
    const party = partyFor(c.req.param("code"), user.id);
    limit(`invites:${user.id}`, LIMITS.invitesPerUser);
    const target = (await body(c)).userId;
    if (typeof target !== "string") throw new Invalid("userId");
    if (!areFriends(db, user.id, target)) throw new Failure(403, "not_friends");
    if (!membership(party.id, target)) {
      db.prepare(
        `INSERT INTO party_invites (party_id, user_id, from_id, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (party_id, user_id) DO UPDATE SET from_id = excluded.from_id, created_at = excluded.created_at`,
      ).run(party.id, target, user.id, Date.now());
    }
    return c.body(null, 204);
  });

  account.post("/parties/:code/decline", (c) => {
    const party = partyByCode(c.req.param("code"));
    db.prepare("DELETE FROM party_invites WHERE party_id = ? AND user_id = ?").run(party.id, c.get("user").id);
    return c.body(null, 204);
  });
}
