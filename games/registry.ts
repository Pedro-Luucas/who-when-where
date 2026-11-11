import { definition as digSite } from "./dig-site/definition";
import { definition as firstToLast } from "./first-to-last/definition";
import { definition as outline } from "./outline/definition";
import { definition as overland } from "./overland/definition";
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
const DEFINITIONS = [whoWhenWhere, wayfarer, digSite, firstToLast, overland, outline] as const;

export type GameSlug = (typeof DEFINITIONS)[number]["slug"];

export const GAMES: readonly GameDefinition<GameSlug>[] = DEFINITIONS;

export const GAME_SLUGS: readonly GameSlug[] = GAMES.map((game) => game.slug);

const bySlug = new Map<string, GameDefinition<GameSlug>>(GAMES.map((game) => [game.slug, game]));

export const isGameSlug = (value: unknown): value is GameSlug => typeof value === "string" && bySlug.has(value);

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
