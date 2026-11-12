import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// A session is a random token held in an HttpOnly cookie. Only its hash is
// stored, so a copy of the database cannot be used to sign in.

export const SESSION_COOKIE = "www_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

export type User = {
  id: string;
  email: string;
  /** The public handle other players add and see; null until chosen. */
  username: string | null;
  displayName: string;
  /** Which of the avatar colours the player picked. */
  avatar: number;
  locale: string;
  createdAt: number;
  /** "public": anyone may see the profile; "friends": only friends. */
  profileVisibility: ProfileVisibility;
  /** Others never see the player as online. */
  hidePresence: boolean;
  /** ISO 3166-1 alpha-2, shown as a flag and used by the country boards; null unless chosen. */
  country: string | null;
};

export type ProfileVisibility = "public" | "friends";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  locale: string;
  created_at: number;
  username: string | null;
  avatar: number;
  last_seen: number;
  profile_visibility: ProfileVisibility;
  hide_presence: number;
  country: string | null;
  /** "free" or "pro" (plans.ts); Pro lasts until plan_expires_at, or for good when that is null. */
  plan: string;
  plan_expires_at: number | null;
};

export const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  username: row.username,
  displayName: row.display_name,
  avatar: row.avatar,
  locale: row.locale,
  createdAt: row.created_at,
  profileVisibility: row.profile_visibility === "friends" ? "friends" : "public",
  hidePresence: row.hide_presence === 1,
  country: row.country ?? null,
});

export function createSession(db: DatabaseSync, userId: string, now = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    now,
    now + SESSION_TTL_MS,
  );
  return token;
}

/**
 * The account a session token belongs to, if the session is still valid.
 * `renewed` is true when a session past half its life was extended, and the
 * cookie should be sent again.
 */
export function readSession(
  db: DatabaseSync,
  token: string,
  now = Date.now(),
): { user: UserRow; renewed: boolean } | null {
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.display_name, u.locale, u.created_at,
              u.username, u.avatar, u.last_seen, u.profile_visibility, u.hide_presence, u.country,
              u.plan, u.plan_expires_at, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now) as (UserRow & { expires_at: number }) | undefined;
  if (!row) return null;

  const { expires_at: expiresAt, ...user } = row;
  const renewed = expiresAt - now < SESSION_TTL_MS / 2;
  if (renewed) {
    db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(now + SESSION_TTL_MS, tokenHash);
  }
  return { user, renewed };
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

/** Signs an account out everywhere except the given session. */
export function deleteOtherSessions(db: DatabaseSync, userId: string, keepToken: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").run(userId, hashToken(keepToken));
}

export function deleteExpiredSessions(db: DatabaseSync, now = Date.now()): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
}
