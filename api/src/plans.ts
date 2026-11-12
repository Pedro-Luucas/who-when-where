import type { DatabaseSync } from "node:sqlite";
import { utcDay } from "./days.ts";
import { Failure } from "./http.ts";
import type { UserRow } from "./sessions.ts";

// Plans and entitlements: what an account may do. A copy of the site's
// shared/plans.ts (FEATURES, LIMITS, UNLIMITED_PRACTICE_GAMES) — change both
// together; the tests check they match. Nothing here takes payments: Pro is
// set on the users row (scripts/grant-pro.ts) or granted per feature in
// entitlement_grants, and a future billing adapter will fill `subscriptions`.
//
// Nothing is refused unless the API runs with PRO_GATING=on (config.ts).

export const FEATURES = [
  "games.pro",
  "practice.unlimited",
  "archive.all",
  "party.host16",
  "party.unlockGames",
  "expedition.allSettings",
  "stats.deep",
  "cosmetics.pro",
  "streak.freeze3",
  "weekly.past",
  "games.early",
] as const;
export type Feature = (typeof FEATURES)[number];

export const isFeature = (value: unknown): value is Feature => FEATURES.includes(value as Feature);

export type Limits = { practicePerDay: number | null; archiveDays: number | null; partySeats: number };

export const LIMITS: Record<"guest" | "free" | "pro", Limits> = {
  guest: { practicePerDay: 3, archiveDays: 0, partySeats: 0 },
  free: { practicePerDay: 10, archiveDays: 3, partySeats: 8 },
  pro: { practicePerDay: null, archiveDays: null, partySeats: 16 },
};

export const UNLIMITED_PRACTICE_GAMES: readonly string[] = [
  "who-when-where",
  "wayfarer",
  "dig-site",
  "first-to-last",
  "overland",
  "outline",
];

/** Seats in a party while gating is off: what every host had before plans. */
export const SEATS_WITHOUT_GATING = 12;

export type Plan = "free" | "pro";

/** The plan an account is on now: Pro until plan_expires_at (none: no end). */
export function planOf(user: Pick<UserRow, "plan" | "plan_expires_at">, now = Date.now()): Plan {
  return user.plan === "pro" && (user.plan_expires_at === null || user.plan_expires_at > now) ? "pro" : "free";
}

/** SQL for "the account aliased `alias` is on Pro now" (see planOf). */
export const isProSql = (alias: string, now: number) =>
  `(${alias}.plan = 'pro' AND (${alias}.plan_expires_at IS NULL OR ${alias}.plan_expires_at > ${Math.floor(now)}))`;

export type Entitlements = {
  plan: Plan;
  /** When Pro ends; null for no end, or on Free. */
  planExpiresAt: number | null;
  features: Feature[];
  limits: Limits;
  /** Counted today (UTC): practice puzzles that use the allowance. */
  usageToday: { practice: number };
  /** Whether this API refuses what a plan does not include. */
  gating: boolean;
};

/** The features an account has: all of them on Pro, else those granted one by one. */
export function featuresOf(db: DatabaseSync, user: UserRow, now = Date.now()): Set<Feature> {
  if (planOf(user, now) === "pro") return new Set(FEATURES);
  const rows = db
    .prepare("SELECT feature FROM entitlement_grants WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)")
    .all(user.id, now) as { feature: string }[];
  return new Set(rows.map((row) => row.feature).filter(isFeature));
}

export function usageOf(db: DatabaseSync, userId: string, kind: string, day = utcDay()): number {
  const row = db.prepare("SELECT count FROM usage WHERE user_id = ? AND day = ? AND kind = ?").get(userId, day, kind) as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

export function entitlementsOf(db: DatabaseSync, user: UserRow, gating: boolean, now = Date.now()): Entitlements {
  const plan = planOf(user, now);
  return {
    plan,
    planExpiresAt: plan === "pro" ? user.plan_expires_at : null,
    features: [...featuresOf(db, user, now)],
    limits: LIMITS[plan],
    usageToday: { practice: usageOf(db, user.id, "practice", utcDay(now)) },
    gating,
  };
}

/** Throws 402 upgrade_required when gating is on and the account lacks `feature`. */
export function requireFeature(db: DatabaseSync, user: UserRow, feature: Feature, gating: boolean): void {
  if (gating && !featuresOf(db, user).has(feature)) throw new Failure(402, "upgrade_required", undefined, feature);
}

/** How many players a party hosted by this account may hold. */
export function seatsFor(user: Pick<UserRow, "plan" | "plan_expires_at">, gating: boolean, now = Date.now()): number {
  if (!gating) return SEATS_WITHOUT_GATING;
  return planOf(user, now) === "pro" ? LIMITS.pro.partySeats : LIMITS.free.partySeats;
}

/** SQL for the seats of the party aliased `party`, from its host's plan (see seatsFor). */
export function seatsSql(party: string, gating: boolean, now = Date.now()): string {
  if (!gating) return String(SEATS_WITHOUT_GATING);
  return `(SELECT CASE WHEN ${isProSql("h", now)} THEN ${LIMITS.pro.partySeats} ELSE ${LIMITS.free.partySeats} END
             FROM users h WHERE h.id = ${party}.host_id)`;
}

export type PracticeTicket = {
  /** Whether this puzzle used the allowance (false: Pro, or a classic game). */
  metered: boolean;
  /** Metered puzzles today, this one included. */
  used: number;
  /** The day's allowance; null when there is none (unmetered, or gating off). */
  limit: number | null;
  /** Puzzles left today; null when unlimited. */
  remaining: number | null;
};

/**
 * Counts a practice puzzle the player starts in `game`. With gating on, a
 * free account past its allowance gets 402 upgrade_required.
 */
export function startPractice(db: DatabaseSync, user: UserRow, game: string, gating: boolean, now = Date.now()): PracticeTicket {
  const day = utcDay(now);
  const unlimited = featuresOf(db, user, now).has("practice.unlimited") || UNLIMITED_PRACTICE_GAMES.includes(game);
  const used = usageOf(db, user.id, "practice", day);
  if (unlimited) return { metered: false, used, limit: null, remaining: null };

  const allowance = LIMITS.free.practicePerDay ?? Infinity;
  if (gating && used >= allowance) throw new Failure(402, "upgrade_required", undefined, "practice.unlimited");
  db.prepare(
    `INSERT INTO usage (user_id, day, kind, count) VALUES (?, ?, 'practice', 1)
     ON CONFLICT (user_id, day, kind) DO UPDATE SET count = count + 1`,
  ).run(user.id, day);
  return {
    metered: true,
    used: used + 1,
    limit: gating ? allowance : null,
    remaining: gating ? Math.max(0, allowance - used - 1) : null,
  };
}
