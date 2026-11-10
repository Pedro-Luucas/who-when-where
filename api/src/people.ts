import type { DatabaseSync } from "node:sqlite";
import { Failure } from "./http.ts";
import type { UserRow } from "./sessions.ts";

// What one player may know about another: never the e-mail address.

/** Someone seen in the last minute and a half counts as online. */
export const ONLINE_MS = 90_000;

/** Columns of `users u` needed to describe a player to others. */
export const PUBLIC_COLUMNS = "u.id, u.username, u.display_name, u.avatar, u.last_seen";

export type PublicRow = {
  id: string;
  username: string | null;
  display_name: string;
  avatar: number;
  last_seen: number;
};

export type PublicUser = {
  id: string;
  username: string;
  /** The name to show: the display name, or the handle when there is none. */
  name: string;
  avatar: number;
  online: boolean;
};

export function toPublic(row: PublicRow, now = Date.now()): PublicUser {
  return {
    id: row.id,
    username: row.username ?? "",
    name: row.display_name || row.username || "",
    avatar: row.avatar,
    online: now - row.last_seen < ONLINE_MS,
  };
}

/** Taking part in the community needs a public handle. */
export function requireUsername(user: UserRow): UserRow & { username: string } {
  if (!user.username) throw new Failure(403, "username_required");
  return user as UserRow & { username: string };
}

export function publicById(db: DatabaseSync, id: string): PublicRow | undefined {
  return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id = ?`).get(id) as PublicRow | undefined;
}

// ── Friendships: one row per pair, ids in order ─────────────────────────────

export type Friendship = { low: string; high: string; requester: string; status: "pending" | "accepted" };

export const pairOf = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export function friendshipOf(db: DatabaseSync, a: string, b: string): Friendship | undefined {
  const [low, high] = pairOf(a, b);
  return db
    .prepare("SELECT low, high, requester, status FROM friendships WHERE low = ? AND high = ?")
    .get(low, high) as Friendship | undefined;
}

export const areFriends = (db: DatabaseSync, a: string, b: string): boolean =>
  friendshipOf(db, a, b)?.status === "accepted";

/** Ids of a player's accepted friends. */
export function friendIds(db: DatabaseSync, userId: string): string[] {
  const rows = db
    .prepare(
      `SELECT CASE WHEN low = ?1 THEN high ELSE low END AS id
         FROM friendships WHERE (low = ?1 OR high = ?1) AND status = 'accepted'`,
    )
    .all(userId) as { id: string }[];
  return rows.map((row) => row.id);
}

/** How the viewer stands with another player. */
export type Relation = "self" | "friends" | "incoming" | "outgoing" | "none";

export function relationOf(db: DatabaseSync, viewerId: string, otherId: string): Relation {
  if (viewerId === otherId) return "self";
  const friendship = friendshipOf(db, viewerId, otherId);
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friends";
  return friendship.requester === viewerId ? "outgoing" : "incoming";
}

/** "?, ?, ?" for an IN (…) list. */
export const placeholders = (count: number): string => Array.from({ length: count }, () => "?").join(", ");
