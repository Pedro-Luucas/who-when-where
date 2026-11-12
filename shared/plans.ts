// ┌──────────────────────────────────────────────────────────────────────────┐
// │ THE PLANS — Guest, Free and Pro (AUDIT_AND_PLAN §7).                     │
// └──────────────────────────────────────────────────────────────────────────┘
//
// Plain data with no imports, so the site, the accounts API's tests and any
// script can read it. The API keeps a copy of FEATURES, LIMITS and
// UNLIMITED_PRACTICE_GAMES in api/src/plans.ts (it is deployed on its own);
// its tests fail until the two match.
//
// THE SWITCH: nothing is locked until gating is turned on.
//
//   NEXT_PUBLIC_PRO_GATING=off      (default) everything is free; no Pro chips, no locks.
//   NEXT_PUBLIC_PRO_GATING=preview  Pro chips, the pricing pill and plan cards show,
//                                   but nothing is locked: for reviewing the look.
//   NEXT_PUBLIC_PRO_GATING=on       soft gates: Pro games, the practice allowance,
//                                   the archive window and locked options apply.
//
// The value is read when the site is built (`next build`). The accounts API has
// its own switch, PRO_GATING=on in its environment, for what it enforces itself
// (402 upgrade_required, the practice allowance, party seats). Both default to off.
// There is no payment integration: Pro is granted by hand (api/scripts/grant-pro.ts).

export type GatingMode = "off" | "preview" | "on";

/** Reads a switch value; anything unknown is "off". */
export const gatingMode = (value: string | undefined): GatingMode =>
  value === "on" || value === "preview" ? value : "off";

/** This build's switch (see above). Written out in full so Next can inline it. */
export const GATING: GatingMode = gatingMode(process.env.NEXT_PUBLIC_PRO_GATING);

export const PLAN_IDS = ["guest", "free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/**
 * What Pro unlocks, one name per gate. A gate is checked with
 * useEntitlements().has(feature) on the site and requireFeature() in the API.
 */
export const FEATURES = [
  /** The Pro-only games (`tier: "pro"` in their definitions). */
  "games.pro",
  /** Practice without a daily allowance. */
  "practice.unlimited",
  /** Every past daily in the archive, not only the last few days. */
  "archive.all",
  /** Host a party of 16 instead of 8. */
  "party.host16",
  /** A Pro host's room may play Pro games, whoever is in it. */
  "party.unlockGames",
  /** Expedition fine-tuning: tries per game, saved presets. */
  "expedition.allSettings",
  /** Weak spots by region and era, accuracy trends, review mode. */
  "stats.deep",
  /** Profile frames, banners, name colours, extra reactions, the Atlas theme. */
  "cosmetics.pro",
  /** Hold up to three streak freezes. */
  "streak.freeze3",
  /** Replay past Weekly Specials. */
  "weekly.past",
  /** New games before everyone else. */
  "games.early",
] as const;
export type Feature = (typeof FEATURES)[number];

export const isFeature = (value: unknown): value is Feature => FEATURES.includes(value as Feature);

/** Numbers each plan allows. null means no limit. */
export type Limits = {
  /** Practice puzzles a day (UTC), outside UNLIMITED_PRACTICE_GAMES. */
  practicePerDay: number | null;
  /** How many past days of the archive may be played. */
  archiveDays: number | null;
  /** Seats in a party the player hosts (0: cannot host). */
  partySeats: number;
};

export const LIMITS: Record<PlanId, Limits> = {
  guest: { practicePerDay: 3, archiveDays: 0, partySeats: 0 },
  free: { practicePerDay: 10, archiveDays: 3, partySeats: 8 },
  pro: { practicePerDay: null, archiveDays: null, partySeats: 16 },
};

/** The six classic games: practice in them never counts against a free account's allowance. */
export const UNLIMITED_PRACTICE_GAMES = [
  "who-when-where",
  "wayfarer",
  "dig-site",
  "first-to-last",
  "overland",
  "outline",
] as const;

/**
 * Prices shown on /pricing — for display only, nothing can be bought yet.
 * USD for English, BRL for Portuguese (AUDIT_AND_PLAN §7.2).
 */
export const PRICES = {
  en: { currency: "USD", monthly: 3.99, yearly: 29.99 },
  pt: { currency: "BRL", monthly: 14.9, yearly: 99 },
} as const;
