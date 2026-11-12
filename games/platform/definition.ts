import type { Localized } from "../../lib/i18n";
import type { FamilyId } from "../families";

// What the site knows about a game without loading it. A definition is plain
// data — no components, no rosters — so the hub, the layout, the leaderboards
// and the server can all list every game for the price of a few lines each.
// The game itself (its board and its data) is loaded on demand: games/loaders.tsx.

/**
 * The mechanic a game is built on:
 * pin (drop a pin, scored by distance) · pick (choose between options) ·
 * order (sort things) · name (type the answer) · mixed (several of them).
 */
export type Engine = "pin" | "pick" | "order" | "name" | "mixed";

/** The difficulties an expedition offers; each game says what they mean for it. */
export const DIFFICULTY_NAMES = ["relaxed", "standard", "hard"] as const;
export type Difficulty = (typeof DIFFICULTY_NAMES)[number];

/** The one number a player can turn for a game in an expedition: its tries per puzzle. */
export type TriesSetting = {
  /** Names the stepper: "Digs in Dig Site". */
  label: Localized;
  min: number;
  max: number;
  /** The tries each difficulty gives; `standard` is also the default. */
  presets: Record<Difficulty, number>;
  /**
   * The field that carried this number before settings were kept per game
   * (old saves, old challenge links, and the accounts API until it is updated).
   */
  legacy?: "digs" | "guesses" | "attempts" | "spare";
};

/**
 * A version of a game a player can choose in practice: a region, a measure.
 * The first is the default, and the one the daily puzzle, expeditions and
 * parties use.
 */
export type Variant = { id: string; name: Localized };

export type GameDefinition<Slug extends string = string> = {
  /** Names the game everywhere: its address (/play/<slug>), its save, its scores. */
  slug: Slug;
  title: string;
  /** One or two words on what the game is about, shown above the title. */
  theme: Localized;
  /** The rule in a sentence or two, for the hub card. */
  blurb: Localized;
  /** The page's description for search engines and link previews. */
  description: string;
  /** Which family the game belongs to: its colour and icon (games/families.ts). */
  family: FamilyId;
  engine: Engine;
  /**
   * "pro": a Pro game (AUDIT_AND_PLAN §7.2). It shows a Pro chip, and its pages
   * are locked to accounts without Pro — but only while the plans switch in
   * shared/plans.ts is on. Left out: free. The dailies (games/daily-set.ts) are
   * always free.
   */
  tier?: "pro";
  /**
   * Where the daily puzzles are kept: `{ days: { [day]: record } }` under `key`
   * in lib/storage. A record's moves are the list in `progressField` (the longer
   * list is the newer save); `lists` names any other lists a record must have.
   */
  save: { key: string; progressField: string; lists?: string[] };
  /** How a finished day reads on the hub: its short result ("3/6"), or its points out of 1,000. */
  status: "detail" | "points";
  /** Raise this when the scoring changes, so results already worked out are worked out again. */
  scoring?: number;
  /** The versions offered in practice (see Variant). Left out: practice deals from the whole roster. */
  variants?: readonly Variant[];
  /** Says where the game's facts come from, when a licence asks for it ("Data: World Bank, CC BY 4.0"). */
  credit?: { text: string; href: string };
  /** How the game takes part in expeditions and parties. */
  expedition: {
    /** The game in a few words, next to its name in the setup. */
    about: Localized;
    tries?: TriesSetting;
  };
};

/** Declares a game. Keeps the slug's exact type, so the registry knows every slug by name. */
export function defineGame<const Slug extends string>(definition: GameDefinition<Slug>): GameDefinition<Slug> {
  return definition;
}
