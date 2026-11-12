import type { DatabaseSync } from "node:sqlite";
import type { Hono } from "hono";
import { dmChannel } from "./chat.ts";
import { Failure, type Deps, type Env } from "./http.ts";
import { PUBLIC_COLUMNS, areFriends, toPublic, type PublicRow, type PublicUser } from "./people.ts";
import { isPushEndpoint, type PushMessage, type Pusher } from "./push.ts";
import { LIMITS } from "./rate-limit.ts";
import { Invalid, asObject } from "./validate.ts";

// The inbox: what happened to a player while they were away (a challenge, a
// friend request, someone beating their score), their conversations, and the
// Web Push notifications that tell them about it.

export const NOTIFICATION_KINDS = [
  /** A friend sent the player a challenge. `points`: what the friend scored. */
  "challenge",
  /** Someone played the player's challenge. `points`: what they scored. */
  "challenge_played",
  "friend_request",
  "friend_accepted",
  /** Someone signed up with the player's invitation link. */
  "invite_joined",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Notifications kept per player; older ones are dropped. */
const KEPT = 100;
/** Shown in the inbox. */
const SHOWN = 50;
const CONVERSATIONS = 30;

export type Notification = {
  id: number;
  kind: NotificationKind;
  at: number;
  read: boolean;
  user: PublicUser | null;
  /** A challenge id, for the challenge kinds. */
  ref: string;
  points: number | null;
};

type PushWords = { title: string; body: string };

/** What a push notification says, in the player's language. */
const PUSH_TEXT: Record<"en" | "pt", Record<NotificationKind, (name: string, points: string) => PushWords>> = {
  en: {
    challenge: (name, points) => ({ title: `${name} challenged you`, body: `They scored ${points}. Can you beat it?` }),
    challenge_played: (name, points) => ({ title: `${name} took your challenge`, body: `They scored ${points}. See who won.` }),
    friend_request: (name) => ({ title: "New friend request", body: `${name} wants to be friends.` }),
    friend_accepted: (name) => ({ title: "You have a new friend", body: `${name} accepted your request.` }),
    invite_joined: (name) => ({ title: `${name} joined`, body: "They signed up with your invitation. Say hello!" }),
  },
  pt: {
    challenge: (name, points) => ({ title: `${name} te desafiou`, body: `Fez ${points} pontos. Consegue superar?` }),
    challenge_played: (name, points) => ({ title: `${name} aceitou seu desafio`, body: `Fez ${points} pontos. Veja quem venceu.` }),
    friend_request: (name) => ({ title: "Novo pedido de amizade", body: `${name} quer ser seu amigo.` }),
    friend_accepted: (name) => ({ title: "Você tem um novo amigo", body: `${name} aceitou seu pedido.` }),
    invite_joined: (name) => ({ title: `${name} entrou`, body: "Criou a conta com o seu convite. Diga oi!" }),
  },
};

function urlOf(kind: NotificationKind, ref: string, actor: PublicRow | undefined): string {
  if (kind === "challenge" || kind === "challenge_played") return `/c/${ref}`;
  if (kind === "friend_request") return "/inbox";
  return actor?.username ? `/u/${actor.username}` : "/inbox";
}

/** Puts something in a player's inbox, and tells their browsers if they agreed to it. */
export function notify(
  db: DatabaseSync,
  pusher: Pusher,
  to: string,
  kind: NotificationKind,
  actorId: string,
  extra: { ref?: string; points?: number } = {},
): void {
  if (to === actorId) return;
  const now = Date.now();
  db.prepare("INSERT INTO notifications (user_id, kind, actor_id, ref, points, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    to,
    kind,
    actorId,
    extra.ref ?? "",
    extra.points ?? null,
    now,
  );
  db.prepare(
    `DELETE FROM notifications WHERE user_id = ?1 AND id NOT IN
       (SELECT id FROM notifications WHERE user_id = ?1 ORDER BY id DESC LIMIT ${KEPT})`,
  ).run(to);

  if (!pusher.publicKey) return;
  const actor = db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id = ?`).get(actorId) as PublicRow | undefined;
  const recipient = db.prepare("SELECT locale FROM users WHERE id = ?").get(to) as { locale: string } | undefined;
  const locale = recipient?.locale === "pt" ? "pt" : "en";
  const name = actor ? actor.display_name || actor.username || "?" : "?";
  const points = new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US").format(extra.points ?? 0);
  const words = PUSH_TEXT[locale][kind](name, points);
  const message: PushMessage = { ...words, url: urlOf(kind, extra.ref ?? "", actor), tag: `${kind}-${extra.ref || actorId}` };
  void pusher.toUser(to, message);
}

/**
 * How many notifications the player has not seen. The pulse leaves out friend
 * requests (`besidesRequests`): it counts the requests waiting on their own.
 */
export function unreadNotifications(db: DatabaseSync, userId: string, besidesRequests = false): number {
  const except = besidesRequests ? " AND kind <> 'friend_request'" : "";
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL${except}`).get(userId) as {
      n: number;
    }
  ).n;
}

type NotificationRow = PublicRow & {
  notification_id: number;
  kind: NotificationKind;
  ref: string;
  points: number | null;
  created_at: number;
  read_at: number | null;
};

export function registerInbox(account: Hono<Env>, { db, limit, body }: Deps, pusher: Pusher): void {
  /** The latest notifications and the conversations with friends, newest first. */
  account.get("/inbox", (c) => {
    const user = c.get("user");
    const now = Date.now();
    const rows = db
      .prepare(
        `SELECT n.id AS notification_id, n.kind, n.ref, n.points, n.created_at, n.read_at, ${PUBLIC_COLUMNS}
           FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
          WHERE n.user_id = ? ORDER BY n.id DESC LIMIT ${SHOWN}`,
      )
      .all(user.id) as NotificationRow[];
    const notifications: Notification[] = rows.map((row) => ({
      id: row.notification_id,
      kind: row.kind,
      at: row.created_at,
      read: row.read_at !== null,
      user: row.id ? toPublic(row, now) : null,
      ref: row.ref,
      points: row.points,
    }));

    // One line per conversation: the newest message, and how many are unread.
    const channels = db
      .prepare(
        `SELECT channel, MAX(id) AS last_id FROM messages
          WHERE channel LIKE 'dm:%' AND (user_id = ?1 OR to_id = ?1)
          GROUP BY channel ORDER BY last_id DESC LIMIT ${CONVERSATIONS}`,
      )
      .all(user.id) as { channel: string; last_id: number }[];
    const conversations = channels.flatMap(({ channel, last_id }) => {
      const [, low, high] = channel.split(":");
      const otherId = low === user.id ? high : low;
      // Conversations with someone who is no longer a friend cannot be opened.
      if (!otherId || !areFriends(db, user.id, otherId)) return [];
      const other = db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id = ?`).get(otherId) as PublicRow | undefined;
      const last = db.prepare("SELECT user_id, body, created_at FROM messages WHERE id = ?").get(last_id) as {
        user_id: string;
        body: string;
        created_at: number;
      };
      const { unread } = db
        .prepare(
          `SELECT COUNT(*) AS unread FROM messages m
            WHERE m.channel = ? AND m.to_id = ? AND m.id > COALESCE((SELECT last_id FROM chat_reads WHERE user_id = ? AND channel = ?), 0)`,
        )
        .get(channel, user.id, user.id, dmChannel(user.id, otherId)) as { unread: number };
      if (!other) return [];
      return [{ user: toPublic(other, now), last: { body: last.body, at: last.created_at, mine: last.user_id === user.id }, unread }];
    });

    return c.json({ notifications, unread: unreadNotifications(db, user.id), conversations });
  });

  /** Marks every notification read. */
  account.post("/inbox/read", (c) => {
    db.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(Date.now(), c.get("user").id);
    return c.body(null, 204);
  });

  // ── Web Push ──────────────────────────────────────────────────────────────

  /** Keeps a browser's push subscription (PushSubscription.toJSON()). */
  account.put("/push", async (c) => {
    const user = c.get("user");
    if (!pusher.publicKey) throw new Failure(404, "push_unavailable");
    limit(`push:${user.id}`, LIMITS.pushPerUser);
    const input = await body(c);
    const endpoint = input.endpoint;
    if (typeof endpoint !== "string" || endpoint.length > 1000 || !isPushEndpoint(endpoint)) throw new Invalid("endpoint");
    const keys = asObject(input.keys, "keys");
    const p256dh = keys.p256dh;
    const auth = keys.auth;
    if (typeof p256dh !== "string" || Buffer.from(p256dh, "base64url").length !== 65) throw new Invalid("keys.p256dh");
    if (typeof auth !== "string" || Buffer.from(auth, "base64url").length !== 16) throw new Invalid("keys.auth");
    db.prepare(
      `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    ).run(endpoint, user.id, p256dh, auth, Date.now());
    // A handful of browsers per player is plenty.
    db.prepare(
      `DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint NOT IN
         (SELECT endpoint FROM push_subscriptions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 10)`,
    ).run(user.id);
    return c.body(null, 204);
  });

  account.delete("/push", async (c) => {
    const endpoint = (await body(c)).endpoint;
    if (typeof endpoint !== "string") throw new Invalid("endpoint");
    db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").run(endpoint, c.get("user").id);
    return c.body(null, 204);
  });

  /** Sends the player a notification, to check it works. */
  account.post("/push/test", async (c) => {
    const user = c.get("user");
    if (!pusher.publicKey) throw new Failure(404, "push_unavailable");
    limit(`push:${user.id}`, LIMITS.pushPerUser);
    const pt = user.locale === "pt";
    await pusher.toUser(user.id, {
      title: "Who When Where",
      body: pt ? "Notificações ligadas. Até amanhã!" : "Notifications are on. See you tomorrow!",
      url: "/daily",
      tag: "test",
    });
    return c.body(null, 204);
  });
}
