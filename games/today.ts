"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useDayNumber } from "@/lib/clock";
import { readStore, subscribeToStore, usePersistent } from "@/lib/storage";
import { movesOf } from "./platform/store";
import { GAMES, type GameSlug } from "./registry";
import { useDailyResults } from "./results";

// How each game stands today, for the catalogue, the dailies strip and the
// setup panel. Read from the saves and the scored results, so no game is loaded.

export type TodayState = "done" | "started" | "todo";
export type Today = { state: TodayState; points?: number; detail?: string };

/** The games with moves on `day` that are not finished, as one string (a stable snapshot). */
function startedOn(day: number): string {
  if (!day) return "";
  return GAMES.filter((game) => {
    const save = readStore<{ days?: Record<string, unknown> } | null>(game.save.key, null);
    return movesOf(game, save?.days?.[day]).length > 0;
  })
    .map((game) => game.slug)
    .join(",");
}

/** Today's puzzle number, and how the player stands in each game today. Browser only. */
export function useToday(): { day: number; of: (slug: GameSlug) => Today; done: number } {
  const day = useDayNumber();
  const results = useDailyResults();
  const started = useSyncExternalStore(
    subscribeToStore,
    () => startedOn(day),
    () => "",
  );
  const finished = new Map(results.filter((result) => result.day === day).map((result) => [result.game, result]));
  const going = new Set(started.split(","));
  const of = (slug: GameSlug): Today => {
    const result = finished.get(slug);
    if (result) return { state: "done", points: result.points, detail: result.detail };
    return { state: going.has(slug) ? "started" : "todo" };
  };
  return { day, of, done: finished.size };
}

const NO_FAVOURITES: string[] = [];
const isList = (value: unknown) => Array.isArray(value) && value.every((entry) => typeof entry === "string");

/** The games the player starred, kept on the device. */
export function useFavourites(): [Set<string>, (slug: string) => void] {
  const [list, setList] = usePersistent<string[]>("favourites:v1", NO_FAVOURITES, isList);
  const toggle = useCallback(
    (slug: string) => setList((previous) => (previous.includes(slug) ? previous.filter((entry) => entry !== slug) : [...previous, slug])),
    [setList],
  );
  return [new Set(list), toggle];
}
