import { DIFFICULTY_NAMES, type Difficulty, type TriesSetting } from "@/games/platform/definition";
import { GAMES, GAME_SLUGS, inChallenge, isGameSlug, type GameSlug } from "@/games/registry";

// An expedition is a custom game: puzzles from any of the games, one after
// the other, played alone or by a whole party. These are its rules.
//
// What can be set for a game comes from the game's own definition (its tries,
// their bounds, what each difficulty means for it), so a new game brings its
// settings with it. The accounts API validates the same shape for parties
// (api/src/validate.ts).

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
  /** Tries per puzzle, for each game that lets them be set (see TRIES_GAMES). */
  tries: Partial<Record<GameSlug, number>>;
  /** In a party — together: nobody moves on until everyone has finished the puzzle. */
  pace: (typeof PACES)[number];
};

/** The games whose tries a player can turn, with what their definitions say about them. */
export const TRIES_GAMES: { slug: GameSlug; title: string; tries: TriesSetting }[] = GAMES.flatMap(
  ({ slug, title, expedition }) => (expedition.tries ? [{ slug, title, tries: expedition.tries }] : []),
);

export { DIFFICULTY_NAMES };
export type { Difficulty };

/** Every game's tries at a difficulty. */
const triesAt = (name: Difficulty): ExpeditionSettings["tries"] =>
  Object.fromEntries(TRIES_GAMES.map(({ slug, tries }) => [slug, tries.presets[name]]));

export const DEFAULT_SETTINGS: ExpeditionSettings = {
  // One puzzle of each game of the daily challenge; the others are a tap away in the setup.
  rounds: Object.fromEntries(GAME_SLUGS.map((game) => [game, inChallenge(game) ? 1 : 0])) as Record<GameSlug, number>,
  order: "grouped",
  timeLimit: 0,
  tries: triesAt("standard"),
  pace: "free",
};

/** Puzzles in one expedition. */
export const stageCount = (settings: Pick<ExpeditionSettings, "rounds">): number =>
  GAME_SLUGS.reduce((sum, game) => sum + (settings.rounds[game] ?? 0), 0);

/** The games an expedition has puzzles of, in the order they are played. */
export const gamesIn = (settings: Pick<ExpeditionSettings, "rounds">): GameSlug[] =>
  GAME_SLUGS.filter((game) => (settings.rounds[game] ?? 0) > 0);

/** The same settings, with every game's tries set to a difficulty. */
export const withDifficulty = (settings: ExpeditionSettings, name: Difficulty): ExpeditionSettings => ({
  ...settings,
  tries: triesAt(name),
});

/** The named difficulty the tries add up to, or "custom". */
export function difficultyOf(settings: ExpeditionSettings): Difficulty | "custom" {
  const match = DIFFICULTY_NAMES.find((name) =>
    TRIES_GAMES.every(({ slug, tries }) => settings.tries[slug] === tries.presets[name]),
  );
  return match ?? "custom";
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function integer(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function choice<T extends string | number>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

/**
 * Settings from anywhere (a link, an old save, the server), made whole and
 * valid. Settings kept before tries were per game named them `digs`,
 * `guesses`, `attempts` and `spare`: those are still read, through the field
 * each game's definition says was its own.
 */
export function normalizeSettings(value: unknown): ExpeditionSettings {
  const input = isObject(value) ? value : {};
  const rounds = isObject(input.rounds) ? input.rounds : {};
  const tries = isObject(input.tries) ? input.tries : {};
  const defaults = DEFAULT_SETTINGS;
  const settings: ExpeditionSettings = {
    rounds: Object.fromEntries(
      GAME_SLUGS.map((game) => [game, integer(rounds[game], 0, MAX_ROUNDS, defaults.rounds[game])]),
    ) as Record<GameSlug, number>,
    order: choice(input.order, ORDERS, defaults.order),
    timeLimit: choice(input.timeLimit, TIME_LIMITS, defaults.timeLimit),
    tries: Object.fromEntries(
      TRIES_GAMES.map(({ slug, tries: setting }) => {
        const given = tries[slug] ?? (setting.legacy ? input[setting.legacy] : undefined);
        return [slug, integer(given, setting.min, setting.max, setting.presets.standard)];
      }),
    ),
    pace: choice(input.pace, PACES, defaults.pace),
  };
  // An expedition has at least one puzzle.
  return stageCount(settings) > 0 ? settings : { ...settings, rounds: { ...defaults.rounds } };
}

/**
 * The settings as they are sent to the accounts API: as they are, plus the
 * older fields an API from before per-game tries still asks for. Where two
 * games once shared a field, the one whose tries differ from `before` (what
 * the server last had) speaks for both — so the stepper a host has just
 * turned is the one that sticks.
 */
export function wireSettings(settings: ExpeditionSettings, before?: ExpeditionSettings): ExpeditionSettings {
  const older: Record<string, number> = {};
  for (const { slug, tries } of TRIES_GAMES) {
    if (!tries.legacy) continue;
    const value = settings.tries[slug] ?? tries.presets.standard;
    const turned = before !== undefined && before.tries[slug] !== value;
    if (!(tries.legacy in older) || turned) older[tries.legacy] = value;
  }
  return { ...settings, ...older };
}

// ── Challenge links: an expedition someone else can play, puzzle for puzzle ──

type Challenge = { seed: string; settings: ExpeditionSettings };

/**
 * What a link carries: the seed, the order, the clock, and — by slug — the
 * games in play: their puzzles, or [puzzles, tries]. A named difficulty (`d`)
 * stands for every game's tries.
 */
type ChallengeCode = {
  s: string;
  o: string;
  t: number;
  d?: Difficulty;
  g: { [slug: string]: number | [rounds: number, tries: number] };
};

// Links made before games were named by slug listed these six by position.
const GAMES_BY_POSITION = ["who-when-where", "wayfarer", "dig-site", "first-to-last", "overland", "outline"];

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
export function encodeChallenge(challenge: { seed: string; settings: unknown }): string {
  const settings = normalizeSettings(challenge.settings);
  const difficulty = difficultyOf(settings);
  const code: ChallengeCode = { s: challenge.seed, o: settings.order, t: settings.timeLimit, g: {} };
  if (difficulty !== "custom") code.d = difficulty;
  for (const game of gamesIn(settings)) {
    const tries = settings.tries[game];
    code.g[game] = difficulty === "custom" && tries !== undefined ? [settings.rounds[game], tries] : settings.rounds[game];
  }
  return toBase64Url(JSON.stringify(code));
}

const isSeed = (value: unknown): value is string => typeof value === "string" && /^[\w-]{4,24}$/.test(value);

export function decodeChallenge(code: string | null): Challenge | null {
  if (!code || code.length > 4000) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(code));

    if (Array.isArray(parsed)) {
      const [seed, counts, order, timeLimit, digs, guesses, attempts, spare] = parsed as unknown[];
      if (!isSeed(seed) || !Array.isArray(counts)) return null;
      // A link made before a game existed has no puzzles of it.
      const rounds = Object.fromEntries(GAME_SLUGS.map((game) => [game, 0]));
      GAMES_BY_POSITION.forEach((game, i) => {
        if (isGameSlug(game)) rounds[game] = counts[i] ?? 0;
      });
      return { seed, settings: normalizeSettings({ rounds, order, timeLimit, digs, guesses, attempts, spare }) };
    }

    if (!isObject(parsed) || !isSeed(parsed.s) || !isObject(parsed.g)) return null;
    const games = parsed.g;
    const rounds: Record<string, unknown> = {};
    const tries: Record<string, unknown> = DIFFICULTY_NAMES.includes(parsed.d as Difficulty)
      ? { ...triesAt(parsed.d as Difficulty) }
      : {};
    // A game the link does not name is not played.
    for (const game of GAME_SLUGS) {
      const entry = games[game];
      rounds[game] = Array.isArray(entry) ? entry[0] : (entry ?? 0);
      if (Array.isArray(entry)) tries[game] = entry[1];
    }
    return { seed: parsed.s, settings: normalizeSettings({ rounds, order: parsed.o, timeLimit: parsed.t, tries }) };
  } catch {
    return null;
  }
}

/** A fresh seed: which puzzles an expedition deals. */
export function newSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 10);
}
