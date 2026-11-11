import { randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { registerChat } from "./chat.ts";
import type { Config } from "./config.ts";
import { Failure, isUniqueViolation, type Deps, type Env } from "./http.ts";
import { registerParties } from "./parties.ts";
import { BusyError, hashPassword, verifyDecoy, verifyPassword } from "./passwords.ts";
import { LIMITS, RateLimiter, type Limit } from "./rate-limit.ts";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  deleteOtherSessions,
  deleteSession,
  readSession,
  toUser,
  type UserRow,
} from "./sessions.ts";
import { registerPublicSocial, registerSocial } from "./social.ts";
import {
  AVATARS,
  Invalid,
  asObject,
  readAvatar,
  readDisplayName,
  readEmail,
  readLocale,
  readNewPassword,
  readPassword,
  readSaves,
  readUsername,
} from "./validate.ts";

/** Most puzzles one account may keep: decades of daily play across many games. */
const MAX_SAVES_PER_USER = 20_000;

/** How often an account's "last seen" is refreshed while it keeps calling. */
const SEEN_EVERY_MS = 20_000;

/** Which unique column a failed insert or update collided on. */
const takenCode = (error: unknown) =>
  error instanceof Error && error.message.includes("username") ? "username_taken" : "email_taken";

export function createApp(db: DatabaseSync, config: Config, limiter = new RateLimiter()) {
  const app = new Hono<Env>();

  function clientAddress(c: Context): string {
    if (config.clientIpHeader) {
      // Behind a CDN the proxy only sees the CDN's address; the CDN names the visitor.
      const named = c.req.header(config.clientIpHeader)?.split(",")[0]?.trim();
      if (named) return named;
    }
    if (config.trustProxy) {
      // The proxy in front of us appends the address it saw; take that one.
      const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
      if (forwarded) return forwarded;
    }
    try {
      return getConnInfo(c).remote.address ?? "unknown";
    } catch {
      return "unknown"; // not served over a socket (tests)
    }
  }

  function limit(key: string, rule: Limit): void {
    const retryAfter = limiter.hit(key, rule);
    if (retryAfter) throw new Failure(429, "rate_limited", retryAfter);
  }

  function startSession(c: Context, userId: string): string {
    const token = createSession(db, userId);
    sendSessionCookie(c, token);
    return token;
  }

  function sendSessionCookie(c: Context, token: string): void {
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
  }

  async function body(c: Context): Promise<Record<string, unknown>> {
    return asObject(await c.req.json().catch(() => undefined));
  }

  /** The signed-in account, when the request carries a valid session. */
  function viewer(c: Context): UserRow | null {
    const token = getCookie(c, SESSION_COOKIE);
    return (token && readSession(db, token)?.user) || null;
  }

  const deps: Deps = { db, limit, body, viewer };

  /** Re-checks the password before a sensitive change. */
  async function confirmPassword(user: UserRow, value: unknown, field = "password"): Promise<void> {
    limit(`confirm:${user.id}`, LIMITS.confirmPerUser);
    if (!(await verifyPassword(readPassword(value, field), user.password_hash))) {
      throw new Failure(403, "wrong_password");
    }
  }

  app.onError((error, c) => {
    if (error instanceof Failure) {
      if (error.retryAfter) c.header("Retry-After", String(error.retryAfter));
      return c.json({ error: error.code }, error.status);
    }
    if (error instanceof Invalid) return c.json({ error: "invalid", field: error.field }, 400);
    if (error instanceof BusyError) return c.json({ error: "busy" }, 503);
    if (error instanceof HTTPException) return c.json({ error: "bad_request" }, error.status);
    console.error(error);
    return c.json({ error: "internal" }, 500);
  });
  app.notFound((c) => c.json({ error: "not_found" }, 404));

  app.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
  });

  // Changes must come from our own pages. Browsers say where a request was
  // made from; a form on another site cannot send JSON without asking first.
  app.use(async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const site = c.req.header("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") throw new Failure(403, "cross_site");
      if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
        throw new Failure(400, "json_required");
      }
    }
    await next();
  });

  app.use(bodyLimit({ maxSize: 1024 * 1024 }));

  app.get("/health", (c) => {
    db.prepare("SELECT 1").get();
    return c.json({ ok: true });
  });

  // ── Signing up, in and out ──────────────────────────────────────────────

  app.post("/auth/signup", async (c) => {
    limit(`signup:${clientAddress(c)}`, LIMITS.signupPerIp);
    const input = await body(c);
    const email = readEmail(input.email);
    const password = readNewPassword(input.password);
    const displayName = input.displayName === undefined ? "" : readDisplayName(input.displayName);
    const locale = input.locale === undefined ? "en" : readLocale(input.locale);
    const username = input.username === undefined ? null : readUsername(input.username);

    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new Failure(409, "email_taken");
    if (username && db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
      throw new Failure(409, "username_taken");
    }
    const passwordHash = await hashPassword(password);

    const now = Date.now();
    const row: UserRow = {
      id: randomUUID(),
      email,
      password_hash: passwordHash,
      display_name: displayName,
      locale,
      created_at: now,
      username,
      avatar: randomInt(AVATARS),
      last_seen: now,
    };
    try {
      db.prepare(
        `INSERT INTO users
           (id, email, password_hash, display_name, locale, username, avatar, last_seen, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.email,
        row.password_hash,
        row.display_name,
        row.locale,
        row.username,
        row.avatar,
        now,
        now,
        now,
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new Failure(409, takenCode(error));
      throw error;
    }
    startSession(c, row.id);
    return c.json({ user: toUser(row) }, 201);
  });

  app.post("/auth/login", async (c) => {
    const input = await body(c);
    const email = readEmail(input.email);
    const password = readPassword(input.password);
    limit(`login-ip:${clientAddress(c)}`, LIMITS.loginPerIp);
    limit(`login:${email}`, LIMITS.loginPerEmail);

    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    if (!row) {
      await verifyDecoy(password);
      throw new Failure(401, "invalid_credentials");
    }
    if (!(await verifyPassword(password, row.password_hash))) throw new Failure(401, "invalid_credentials");

    startSession(c, row.id);
    return c.json({ user: toUser(row) });
  });

  app.post("/auth/logout", (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) deleteSession(db, token);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  // Leaderboards and profiles are open to everyone.
  registerPublicSocial(app, deps);

  // ── Everything below needs a session ────────────────────────────────────

  const account = new Hono<Env>();

  account.use(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const session = token ? readSession(db, token) : null;
    if (!token || !session) throw new Failure(401, "unauthenticated");
    if (session.renewed) sendSessionCookie(c, token);
    const now = Date.now();
    if (now - session.user.last_seen > SEEN_EVERY_MS) {
      db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").run(now, session.user.id);
    }
    c.set("user", session.user);
    c.set("token", token);
    await next();
  });

  account.get("/me", (c) => c.json({ user: toUser(c.get("user")) }));

  account.patch("/me", async (c) => {
    const user = c.get("user");
    const input = await body(c);
    const next: UserRow = { ...user };
    if (input.displayName !== undefined) next.display_name = readDisplayName(input.displayName);
    if (input.locale !== undefined) next.locale = readLocale(input.locale);
    if (input.username !== undefined) next.username = readUsername(input.username);
    if (input.avatar !== undefined) next.avatar = readAvatar(input.avatar);
    if (input.email !== undefined) {
      next.email = readEmail(input.email);
      if (next.email !== user.email) await confirmPassword(user, input.currentPassword, "currentPassword");
    }
    try {
      db.prepare(
        "UPDATE users SET email = ?, display_name = ?, locale = ?, username = ?, avatar = ?, updated_at = ? WHERE id = ?",
      ).run(next.email, next.display_name, next.locale, next.username, next.avatar, Date.now(), user.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new Failure(409, takenCode(error));
      throw error;
    }
    return c.json({ user: toUser(next) });
  });

  account.put("/me/password", async (c) => {
    const user = c.get("user");
    const input = await body(c);
    const newPassword = readNewPassword(input.newPassword, "newPassword");
    await confirmPassword(user, input.currentPassword, "currentPassword");
    const passwordHash = await hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      passwordHash,
      Date.now(),
      user.id,
    );
    deleteOtherSessions(db, user.id, c.get("token"));
    return c.body(null, 204);
  });

  account.delete("/me", async (c) => {
    const user = c.get("user");
    await confirmPassword(user, (await body(c)).password);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id); // sessions and saves cascade
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  // ── Saved games ─────────────────────────────────────────────────────────

  /** Saves changed since `?since=` (a cursor from an earlier call), or all of them. */
  account.get("/saves", (c) => {
    const since = Number(c.req.query("since") ?? 0);
    if (!Number.isFinite(since) || since < 0) throw new Invalid("since");
    const cursor = Date.now();
    const rows = db
      .prepare("SELECT game, day, progress, record FROM saves WHERE user_id = ? AND updated_at >= ?")
      .all(c.get("user").id, since) as { game: string; day: number; progress: number; record: string }[];
    return c.json({
      cursor,
      saves: rows.map((row) => ({ ...row, record: JSON.parse(row.record) as unknown })),
    });
  });

  /** Stores puzzles; one is replaced only by a save that is further along. */
  account.put("/saves", async (c) => {
    const user = c.get("user");
    limit(`saves:${user.id}`, LIMITS.savesPerUser);
    const saves = readSaves((await body(c)).saves);

    const now = Date.now();
    const upsert = db.prepare(
      `INSERT INTO saves (user_id, game, day, progress, record, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, game, day) DO UPDATE
         SET progress = excluded.progress, record = excluded.record, updated_at = excluded.updated_at
       WHERE excluded.progress > saves.progress`,
    );
    db.exec("BEGIN");
    try {
      for (const save of saves) upsert.run(user.id, save.game, save.day, save.progress, save.record, now);
      const { total } = db.prepare("SELECT COUNT(*) AS total FROM saves WHERE user_id = ?").get(user.id) as {
        total: number;
      };
      if (total > MAX_SAVES_PER_USER) throw new Failure(413, "too_many_saves");
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return c.body(null, 204);
  });

  registerSocial(account, deps);
  registerChat(account, deps);
  registerParties(account, deps);

  app.route("/", account);
  return app;
}
