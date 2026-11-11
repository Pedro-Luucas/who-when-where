"use client";

import { useEffect } from "react";
import { loadBoard, loadData } from "@/games/loaders";
import type { GameBoard, GameData } from "@/games/platform/types";
import { GAME_SLUGS, isGameSlug, type GameSlug } from "@/games/registry";
import { seededShuffle } from "@/lib/daily";
import type { Locale } from "@/lib/i18n";
import type { Score } from "@/lib/points";
import { gamesIn, type ExpeditionSettings } from "./settings";

// The puzzles of an expedition. Only the games it has puzzles of are fetched:
// their data to deal and score them, their boards to play them.

/**
 * One puzzle: the game, and the ids that name it — six events for First to
 * Last, the two ends of the crossing for Overland, else one.
 */
export type Stage = { game: GameSlug; ids: string[] };

/** An expedition's puzzles, with the data of the games they come from. */
export type Dealt = { stages: Stage[]; data: Partial<Record<GameSlug, GameData>> };

/**
 * Deals an expedition's puzzles. Everyone who holds the same seed and settings
 * gets the same puzzles in the same order, which is what lets a party race.
 */
function buildStages(settings: ExpeditionSettings, seed: string, data: Dealt["data"]): Stage[] {
  const byGame = (game: GameSlug): Stage[] =>
    (data[game]?.deal(`${seed}:${game}`, settings.rounds[game]) ?? []).map((ids) => ({ game, ids }));
  const dealt = new Map(GAME_SLUGS.map((game) => [game, byGame(game)]));
  const of = (game: GameSlug) => dealt.get(game) ?? [];

  if (settings.order === "grouped") return GAME_SLUGS.flatMap(of);

  // One of each game in turn, until every game has run out.
  const turns: Stage[] = [];
  for (let round = 0; turns.length < GAME_SLUGS.reduce((sum, game) => sum + of(game).length, 0); round++) {
    for (const game of GAME_SLUGS) {
      const stage = of(game)[round];
      if (stage) turns.push(stage);
    }
  }
  return settings.order === "shuffle" ? seededShuffle(turns, `${seed}:order`) : turns;
}

/** Remembers the last few answers of an async question, so asking again returns the very same promise. */
function remembered<T>(limit: number) {
  const kept = new Map<string, Promise<T>>();
  return (key: string, ask: () => Promise<T>): Promise<T> => {
    let promise = kept.get(key);
    if (!promise) {
      promise = ask();
      // A failure (the network dropped) is not kept: the next ask tries again.
      promise.catch(() => kept.delete(key));
      kept.set(key, promise);
      if (kept.size > limit) kept.delete(kept.keys().next().value as string);
    }
    return promise;
  };
}

const rememberDeal = remembered<Dealt>(8);
const rememberBoards = remembered<Partial<Record<GameSlug, GameBoard>>>(8);

/** The puzzles of an expedition, once the games in it are loaded. The same promise for the same expedition. */
export function dealStages(settings: ExpeditionSettings, seed: string): Promise<Dealt> {
  const games = gamesIn(settings);
  const key = JSON.stringify([seed, settings.order, games.map((game) => [game, settings.rounds[game]])]);
  return rememberDeal(key, async () => {
    const loaded = await Promise.all(games.map(loadData));
    const data: Dealt["data"] = Object.fromEntries(games.map((game, i) => [game, loaded[i]]));
    return { stages: buildStages(settings, seed, data), data };
  });
}

/** The boards of the games an expedition has puzzles of. The same promise for the same games. */
export function loadBoards(settings: ExpeditionSettings): Promise<Partial<Record<GameSlug, GameBoard>>> {
  const games = gamesIn(settings);
  return rememberBoards(games.join(" "), async () => {
    const loaded = await Promise.all(games.map(loadBoard));
    return Object.fromEntries(games.map((game, i) => [game, loaded[i]]));
  });
}

/**
 * Starts fetching the games an expedition will need while its settings are
 * still on screen, so the first puzzle (and its clock) does not wait for them.
 */
export function usePreloadedGames(settings: ExpeditionSettings | null): void {
  const games = settings ? gamesIn(settings).join(" ") : "";
  useEffect(() => {
    for (const game of games.split(" ")) {
      if (isGameSlug(game)) loadBoard(game).catch(() => {});
    }
  }, [games]);
}

/** The puzzle a stage names, in its game's own shape. */
export const stagePuzzle = (dealt: Dealt, stage: Stage): unknown => dealt.data[stage.game]?.puzzleOf(stage.ids);

/** How a stage stands after `moves`, on the scale every game shares. */
export function stageScore(dealt: Dealt, stage: Stage, moves: unknown[], settings: ExpeditionSettings): Score {
  const puzzle = stagePuzzle(dealt, stage);
  const data = dealt.data[stage.game];
  // A puzzle that is not there cannot be played: it ends at once, for nothing.
  if (!data || puzzle === undefined) return { over: true, points: 0, detail: "" };
  return data.score(puzzle, moves, settings.tries[stage.game]);
}

/** What the stage was about, for the results: a name, never a spoiler shown early. */
export function stageAnswer(dealt: Dealt, stage: Stage, locale: Locale): string {
  const puzzle = stagePuzzle(dealt, stage);
  return puzzle === undefined ? "" : (dealt.data[stage.game]?.answer(puzzle, locale) ?? "");
}
