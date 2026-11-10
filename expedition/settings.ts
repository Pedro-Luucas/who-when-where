import { GAME_SLUGS, type GameSlug } from "@/games/slugs";

// An expedition is a custom game: puzzles from any of the games, one after
// the other, played alone or by a whole party. These are its rules. The
// accounts API validates the same shape (api/src/validate.ts) for parties.

export const ORDERS = ["grouped", "alternate", "shuffle"] as const;
export const PACES = ["free", "together"] as const;
/** Seconds per puzzle; 0 is no clock. */
export const TIME_LIMITS = [0, 60, 90, 120, 180, 300] as const;
export const MAX_ROUNDS = 5;

export type ExpeditionSettings = {
  /** Puzzles of each game; 0 leaves the game out. */
  rounds: Record<GameSlug, number>;
  /** grouped: game by game · alternate: one of each in turn · shuffle: any order. */
  order: (typeof ORDERS)[number];
  timeLimit: number;
  /** Tries per puzzle: digs in Dig Site, guesses in Wayfarer, attempts in First to Last. */
  digs: number;
  guesses: number;
  attempts: number;
  /** In a party — together: nobody moves on until everyone has finished the puzzle. */
  pace: (typeof PACES)[number];
};

/** The bounds of each number a player can turn. */
export const TRIES = {
  digs: { min: 3, max: 6 },
  guesses: { min: 3, max: 6 },
  attempts: { min: 1, max: 4 },
} as const;
export type TriesKey = keyof typeof TRIES;

export const DIFFICULTIES = {
  relaxed: { digs: 6, guesses: 6, attempts: 4 },
  standard: { digs: 5, guesses: 6, attempts: 3 },
  hard: { digs: 4, guesses: 4, attempts: 2 },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;

export const DEFAULT_SETTINGS: ExpeditionSettings = {
  rounds: { "who-when-where": 1, wayfarer: 1, "dig-site": 1, "first-to-last": 1 },
  order: "grouped",
  timeLimit: 0,
  ...DIFFICULTIES.standard,
  pace: "free",
};

/** Puzzles in one expedition. */
export const stageCount = (settings: ExpeditionSettings): number =>
  GAME_SLUGS.reduce((sum, game) => sum + settings.rounds[game], 0);

/** The named difficulty the tries add up to, or "custom". */
export function difficultyOf(settings: ExpeditionSettings): Difficulty | "custom" {
  const match = (Object.keys(DIFFICULTIES) as Difficulty[]).find((name) => {
    const preset = DIFFICULTIES[name];
    return (
      preset.digs === settings.digs && preset.guesses === settings.guesses && preset.attempts === settings.attempts
    );
  });
  return match ?? "custom";
}

function integer(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function choice<T extends string | number>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

/** Settings from anywhere (a link, an old save, the server), made whole and valid. */
export function normalizeSettings(value: unknown): ExpeditionSettings {
  const input = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const rounds = (typeof input.rounds === "object" && input.rounds !== null ? input.rounds : {}) as Record<
    string,
    unknown
  >;
  const defaults = DEFAULT_SETTINGS;
  const settings: ExpeditionSettings = {
    rounds: Object.fromEntries(
      GAME_SLUGS.map((game) => [game, integer(rounds[game], 0, MAX_ROUNDS, defaults.rounds[game])]),
    ) as Record<GameSlug, number>,
    order: choice(input.order, ORDERS, defaults.order),
    timeLimit: choice(input.timeLimit, TIME_LIMITS, defaults.timeLimit),
    digs: integer(input.digs, TRIES.digs.min, TRIES.digs.max, defaults.digs),
    guesses: integer(input.guesses, TRIES.guesses.min, TRIES.guesses.max, defaults.guesses),
    attempts: integer(input.attempts, TRIES.attempts.min, TRIES.attempts.max, defaults.attempts),
    pace: choice(input.pace, PACES, defaults.pace),
  };
  // An expedition has at least one puzzle.
  return stageCount(settings) > 0 ? settings : { ...settings, rounds: { ...defaults.rounds } };
}

// ── Challenge links: an expedition someone else can play, puzzle for puzzle ──

type Challenge = { seed: string; settings: ExpeditionSettings };

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)),
  );

/** The `?c=` value of a link to this very expedition. */
export function encodeChallenge({ seed, settings }: Challenge): string {
  const { rounds, order, timeLimit, digs, guesses, attempts } = settings;
  const counts = GAME_SLUGS.map((game) => rounds[game]);
  return toBase64Url(JSON.stringify([seed, counts, order, timeLimit, digs, guesses, attempts]));
}

export function decodeChallenge(code: string | null): Challenge | null {
  if (!code || code.length > 400) return null;
  try {
    const [seed, counts, order, timeLimit, digs, guesses, attempts] = JSON.parse(fromBase64Url(code)) as unknown[];
    if (typeof seed !== "string" || !/^[\w-]{4,24}$/.test(seed) || !Array.isArray(counts)) return null;
    const rounds = Object.fromEntries(GAME_SLUGS.map((game, i) => [game, counts[i]]));
    return { seed, settings: normalizeSettings({ rounds, order, timeLimit, digs, guesses, attempts }) };
  } catch {
    return null;
  }
}

/** A fresh seed: which puzzles an expedition deals. */
export function newSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 10);
}
