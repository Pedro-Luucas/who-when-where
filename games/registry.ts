import { definition as digSite } from "./dig-site/definition";
import { definition as firstToLast } from "./first-to-last/definition";
import { definition as outline } from "./outline/definition";
import { definition as overland } from "./overland/definition";
import { definition as lifelines } from "./lifelines/definition";
import { definition as clueLadder } from "./clue-ladder/definition";
import { definition as bornHere } from "./born-here/definition";
import { definition as couldTheyMeet } from "./could-they-meet/definition";
import { definition as earlierOrLater } from "./earlier-or-later/definition";
import { definition as sameYear } from "./same-year/definition";
import { definition as pinTheCity } from "./pin-the-city/definition";
import { definition as clickTheCountry } from "./click-the-country/definition";
import { definition as typeTheCountries } from "./type-the-countries/definition";
import { definition as flagPeek } from "./flag-peek/definition";
import { definition as higherOrLower } from "./higher-or-lower/definition";
import { definition as borderChain } from "./border-chain/definition";
import type { GameDefinition } from "./platform/definition";
import { definition as wayfarer } from "./wayfarer/definition";
import { definition as whoWhenWhere } from "./who-when-where/definition";

// Every game on the site, as plain data (see platform/definition.ts): safe to
// import anywhere, the server included, because it pulls in no game.
//
// To add a game: create games/<slug>/ with a definition, a data module and a
// board module, list the definition here, and name the two modules in
// games/loaders.tsx. The hub, the address /play/<slug>, the daily challenge,
// account sync, expeditions and parties pick it up from there. (The accounts
// API keeps its own list of the games that keep scores: api/src/validate.ts.)
//
// New games go at the end: the order is the order of the hub and of the
// puzzles in an expedition.
const DEFINITIONS = [
  whoWhenWhere,
  wayfarer,
  digSite,
  firstToLast,
  overland,
  outline,
  // Wave 1 of the engine games (AUDIT_AND_PLAN §5, phase 6).
  lifelines,
  clueLadder,
  bornHere,
  couldTheyMeet,
  earlierOrLater,
  sameYear,
  pinTheCity,
  clickTheCountry,
  typeTheCountries,
  flagPeek,
  higherOrLower,
  borderChain,
] as const;

export type GameSlug = (typeof DEFINITIONS)[number]["slug"];

export const GAMES: readonly GameDefinition<GameSlug>[] = DEFINITIONS;

export const GAME_SLUGS: readonly GameSlug[] = GAMES.map((game) => game.slug);

const bySlug = new Map<string, GameDefinition<GameSlug>>(GAMES.map((game) => [game.slug, game]));

export const isGameSlug = (value: unknown): value is GameSlug => typeof value === "string" && bySlug.has(value);

/**
 * The daily challenge: the games whose puzzles make up "today" — the dailies
 * strip, the day's progress and share card, a full day in the activity graph.
 * Until "Today's Five" (phase 7) picks the day's games from the whole
 * catalogue, it is the six original games. Every other game still has a daily
 * puzzle of its own (on its page, with its own streak) and a practice mode.
 */
export const CHALLENGE_SLUGS: readonly GameSlug[] = [
  "who-when-where",
  "wayfarer",
  "dig-site",
  "first-to-last",
  "overland",
  "outline",
] satisfies GameSlug[];

export const CHALLENGE_GAMES: readonly GameDefinition<GameSlug>[] = GAMES.filter((game) => CHALLENGE_SLUGS.includes(game.slug));

export const inChallenge = (slug: string): boolean => (CHALLENGE_SLUGS as readonly string[]).includes(slug);

/** A game's definition. */
export function gameBySlug(slug: GameSlug): GameDefinition<GameSlug>;
export function gameBySlug(slug: string): GameDefinition<GameSlug> | undefined;
export function gameBySlug(slug: string): GameDefinition<GameSlug> | undefined {
  return bySlug.get(slug);
}

const record = <T>(read: (game: GameDefinition<GameSlug>) => T) =>
  Object.fromEntries(GAMES.map((game) => [game.slug, read(game)])) as Record<GameSlug, T>;

export const GAME_TITLES = record((game) => game.title);

/** One or two words on what each game is about ("Journeys", "Borders"). */
export const GAME_THEMES = record((game) => game.theme);
