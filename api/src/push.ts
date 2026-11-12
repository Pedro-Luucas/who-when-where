import { createECDH, createPrivateKey, hkdfSync, randomBytes, sign, createCipheriv } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// Web Push, with nothing but node:crypto: the payload is encrypted for the
// browser (RFC 8291, "aes128gcm") and the request is signed with our VAPID
// key (RFC 8292). The browser's push service (Google's, Mozilla's, Apple's,
// Microsoft's) delivers it to the service worker, public/sw.js.
//
// Keys come from the environment (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT); `node scripts/vapid-keys.ts` makes a pair. Without them push
// is off: GET /push/key says so and the site hides the switch.

export type Vapid = {
  /** The uncompressed P-256 point, base64url (65 bytes): what browsers subscribe with. */
  publicKey: string;
  /** The private scalar, base64url (32 bytes). */
  privateKey: string;
  /** Who runs the server, for the push services: "mailto:…" or an https URL. */
  subject: string;
};

export type PushMessage = {
  title: string;
  body: string;
  /** Where a tap on the notification leads, a path on the site. */
  url: string;
  /** Notifications with the same tag replace each other. */
  tag?: string;
};

export type Subscription = { endpoint: string; p256dh: string; auth: string };

/** Something that sends an HTTP request: fetch, or a fake one in tests. */
export type Send = (url: string, init: { method: string; headers: Record<string, string>; body: Uint8Array }) => Promise<{
  status: number;
}>;

const b64 = (bytes: Uint8Array | Buffer): string => Buffer.from(bytes).toString("base64url");
const unb64 = (text: string): Buffer => Buffer.from(text, "base64url");

/** Record size: one record is plenty for a notification. */
const RECORD_SIZE = 4096;
/** How long a push service keeps a message for a browser that is offline. */
const TTL_SECONDS = 24 * 60 * 60;
/** The push services browsers use. Endpoints elsewhere are refused, so the server never posts to arbitrary hosts. */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

export function isPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** The body a browser can decrypt with its subscription's keys (RFC 8291). */
export function encryptPayload(
  payload: Uint8Array,
  subscription: { p256dh: string; auth: string },
  // Fixed in tests only.
  fixed?: { salt: Buffer; serverKey: ReturnType<typeof createECDH> },
): Buffer {
  const receiverKey = unb64(subscription.p256dh);
  const authSecret = unb64(subscription.auth);
  if (receiverKey.length !== 65 || authSecret.length < 16) throw new Error("bad subscription keys");

  const server = fixed?.serverKey ?? createECDH("prime256v1");
  if (!fixed) server.generateKeys();
  const serverPublic = server.getPublicKey();
  const shared = server.computeSecret(receiverKey);
  const salt = fixed?.salt ?? randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), receiverKey, serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  // One record, ending with the last-record delimiter and no padding.
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const sealed = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(serverPublic.length, 20);
  return Buffer.concat([header, serverPublic, sealed]);
}

/** The VAPID token for one push service (RFC 8292): an ES256 JWT for its origin. */
export function vapidToken(vapid: Vapid, endpoint: string, now = Date.now()): string {
  const publicKey = unb64(vapid.publicKey);
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64(leftPad(unb64(vapid.privateKey), 32)),
      x: b64(publicKey.subarray(1, 33)),
      y: b64(publicKey.subarray(33, 65)),
    },
    format: "jwk",
  });
  const header = b64(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64(
    Buffer.from(
      JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 60 * 60, sub: vapid.subject }),
    ),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${claims}.${b64(signature)}`;
}

const leftPad = (bytes: Buffer, length: number): Buffer =>
  bytes.length >= length ? bytes : Buffer.concat([Buffer.alloc(length - bytes.length), bytes]);

/** A fresh VAPID key pair. */
export function newVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64(ecdh.getPublicKey()), privateKey: b64(leftPad(ecdh.getPrivateKey(), 32)) };
}

/** Sends one message to one browser. Returns false when the subscription is gone for good. */
export async function sendPush(vapid: Vapid, subscription: Subscription, message: PushMessage, send: Send): Promise<boolean> {
  const body = encryptPayload(Buffer.from(JSON.stringify(message)), subscription);
  const response = await send(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${vapidToken(vapid, subscription.endpoint)}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(TTL_SECONDS),
      Urgency: "normal",
      ...(message.tag ? { Topic: message.tag.replace(/[^\w-]/g, "").slice(0, 32) } : {}),
    },
    body,
  });
  // 404 and 410: the browser unsubscribed, or the subscription expired.
  return response.status !== 404 && response.status !== 410;
}

/** Sends messages to every browser of a player, quietly: push is a nicety, never a failure. */
export type Pusher = {
  /** The public key browsers subscribe with; null when push is off. */
  publicKey: string | null;
  /** Sends to all of a player's browsers; resolves when done (never rejects). */
  toUser(userId: string, message: PushMessage): Promise<void>;
};

export function createPusher(db: DatabaseSync, vapid: Vapid | null, send: Send = defaultSend): Pusher {
  return {
    publicKey: vapid?.publicKey ?? null,
    async toUser(userId, message) {
      if (!vapid) return;
      const subscriptions = db
        .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
        .all(userId) as Subscription[];
      await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            if (!(await sendPush(vapid, subscription, message, send))) {
              db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(subscription.endpoint);
            }
          } catch (error) {
            console.warn("push failed:", error instanceof Error ? error.message : error);
          }
        }),
      );
    },
  };
}

const defaultSend: Send = async (url, init) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  await response.body?.cancel();
  return { status: response.status };
};
