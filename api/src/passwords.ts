import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Passwords are hashed with scrypt. The cost settings are stored with each
// hash, so they can be raised later without invalidating existing passwords.
const COST = { N: 2 ** 16, r: 8, p: 2 };
const KEY_LENGTH = 32;
const MAX_MEMORY = 256 * 1024 * 1024;

// Each hash holds ~64 MB for a moment. Cap how many run or wait at once so a
// burst of sign-ups cannot exhaust the server.
const MAX_RUNNING = 4;
const MAX_WAITING = 64;
let running = 0;
const waiting: (() => void)[] = [];

export class BusyError extends Error {}

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_RUNNING) {
    if (waiting.length >= MAX_WAITING) throw new BusyError("Too many password checks queued");
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    running++;
  }
  try {
    return await work();
  } finally {
    // Hand the slot straight to the next in line, if any.
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

function derive(password: string, salt: Buffer, cost: typeof COST): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...cost, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export function hashPassword(password: string): Promise<string> {
  return withSlot(async () => {
    const salt = randomBytes(16);
    const key = await derive(password, salt, COST);
    return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return withSlot(async () => {
    const [scheme, N, r, p, salt, key] = stored.split("$");
    if (scheme !== "scrypt" || !key) return false;
    const expected = Buffer.from(key, "base64url");
    const actual = await derive(password, Buffer.from(salt, "base64url"), {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

// Checked when no account matches, so a wrong e-mail takes as long as a wrong password.
let decoy: Promise<string> | undefined;
export async function verifyDecoy(password: string): Promise<void> {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await decoy);
}
