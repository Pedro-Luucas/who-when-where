import type { DatabaseSync } from "node:sqlite";
import type { Hono } from "hono";
import { Failure, type Deps, type Env } from "./http.ts";
import { PUBLIC_COLUMNS, areFriends, pairOf, requireUsername, toPublic, type PublicRow, type PublicUser } from "./people.ts";
import { LIMITS } from "./rate-limit.ts";
import { Invalid, MESSAGE_MAX, readLine } from "./validate.ts";

// Chat rooms: one for everybody, one per pair of friends, one per party.
// Pages poll for what is new, passing the id of the last message they hold.

export const GLOBAL_CHANNEL = "global";
export const dmChannel = (a: string, b: string): string => `dm:${pairOf(a, b).join(":")}`;
export const partyChannel = (partyId: string): string => `party:${partyId}`;

/** Messages sent when a room is first opened. */
const BACKLOG = 60;
/** The most one poll returns. */
const PAGE = 200;
/** How long the global room remembers. */
const GLOBAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type Message = { id: number; at: number; body: string; user: PublicUser };

type MessageRow = PublicRow & { message_id: number; body: string; created_at: number };

const toMessage = (row: MessageRow, now: number): Message => ({
  id: row.message_id,
  at: row.created_at,
  body: row.body,
  user: toPublic(row, now),
});

/** `?after=`: the id of the newest message the page already has. */
export function readAfter(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const after = Number(value);
  if (!Number.isInteger(after) || after < 0) throw new Invalid("after");
  return after;
}

/** A room's messages after `after`, oldest first; without it, the latest few. */
export function listMessages(db: DatabaseSync, channel: string, after: number | undefined): Message[] {
  const select = `SELECT m.id AS message_id, m.body, m.created_at, ${PUBLIC_COLUMNS}
                    FROM messages m JOIN users u ON u.id = m.user_id WHERE m.channel = ?`;
  const rows = (
    after === undefined
      ? db.prepare(`${select} ORDER BY m.id DESC LIMIT ${BACKLOG}`).all(channel).reverse()
      : db.prepare(`${select} AND m.id > ? ORDER BY m.id LIMIT ${PAGE}`).all(channel, after)
  ) as MessageRow[];
  const now = Date.now();
  return rows.map((row) => toMessage(row, now));
}

export function postMessage(
  db: DatabaseSync,
  channel: string,
  userId: string,
  text: unknown,
  toId: string | null = null,
): Message {
  const body = readLine(text, MESSAGE_MAX, "body");
  const now = Date.now();
  const { lastInsertRowid } = db
    .prepare("INSERT INTO messages (channel, user_id, to_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(channel, userId, toId, body, now);
  const row = db
    .prepare(
      `SELECT m.id AS message_id, m.body, m.created_at, ${PUBLIC_COLUMNS}
         FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
    )
    .get(lastInsertRowid) as MessageRow;
  return toMessage(row, now);
}

/** Forgets old talk in the global room; call now and then. */
export function deleteOldMessages(db: DatabaseSync, now = Date.now()): void {
  db.prepare("DELETE FROM messages WHERE channel = ? AND created_at < ?").run(GLOBAL_CHANNEL, now - GLOBAL_TTL_MS);
  // A room that closed with its host's account leaves its chat behind.
  db.exec("DELETE FROM messages WHERE channel LIKE 'party:%' AND substr(channel, 7) NOT IN (SELECT id FROM parties)");
}

export function registerChat(account: Hono<Env>, { db, limit, body }: Deps): void {
  account.get("/chat/global", (c) =>
    c.json({ messages: listMessages(db, GLOBAL_CHANNEL, readAfter(c.req.query("after"))) }),
  );

  account.post("/chat/global", async (c) => {
    const user = requireUsername(c.get("user"));
    limit(`chat:${user.id}`, LIMITS.chatPerUser);
    return c.json({ message: postMessage(db, GLOBAL_CHANNEL, user.id, (await body(c)).body) }, 201);
  });

  /** Direct messages are between friends only. */
  function friendChannel(userId: string, otherId: string): string {
    if (!areFriends(db, userId, otherId)) throw new Failure(403, "not_friends");
    return dmChannel(userId, otherId);
  }

  /** Reading a conversation marks it read. */
  account.get("/chat/dm/:id", (c) => {
    const user = c.get("user");
    const channel = friendChannel(user.id, c.req.param("id"));
    const messages = listMessages(db, channel, readAfter(c.req.query("after")));
    const newest = messages.at(-1);
    if (newest) {
      db.prepare(
        `INSERT INTO chat_reads (user_id, channel, last_id) VALUES (?, ?, ?)
         ON CONFLICT (user_id, channel) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)`,
      ).run(user.id, channel, newest.id);
    }
    return c.json({ messages });
  });

  account.post("/chat/dm/:id", async (c) => {
    const user = requireUsername(c.get("user"));
    const otherId = c.req.param("id");
    const channel = friendChannel(user.id, otherId);
    limit(`chat:${user.id}`, LIMITS.chatPerUser);
    return c.json({ message: postMessage(db, channel, user.id, (await body(c)).body, otherId) }, 201);
  });
}
