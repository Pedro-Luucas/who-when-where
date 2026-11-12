"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useDayNumber } from "@/lib/clock";
import { readStore, subscribeToStore, usePersistent } from "@/lib/storage";
import { STRICT_RULES, streakOf, type Streak } from "@/lib/streak";
import { movesOf } from "./platform/store";
import { CHALLENGE_SLUGS, GAMES, inChallenge, type GameSlug } from "./registry";
import { streakDays, useDailyResults, type DailyResult } from "./results";

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

/** Today's puzzle number, how the player stands in each game today, and how many of the daily challenge are done. Browser only. */
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
  return { day, of, done: [...finished.keys()].filter(inChallenge).length };
}

/** One day of the dailies: how many were finished, and for how many points. */
export type DailyDay = { done: number; points: number };

/** The player's record over the dailies, as it stands today. */
export type DailyRecord = {
  day: number;
  /** Each day with one of the dailies finished. */
  days: Map<number, DailyDay>;
  /** The streak, by the one rule (lib/streak.ts). */
  streak: Streak;
  /** Days in a row with every daily finished (no freezes), and how many such days in all. */
  perfect: { streak: number; longest: number; days: number };
};

export function dailyRecordOf(results: DailyResult[], day: number): DailyRecord {
  const days = new Map<number, DailyDay>();
  for (const result of results) {
    if (!inChallenge(result.game)) continue;
    const entry = days.get(result.day) ?? { done: 0, points: 0 };
    entry.done++;
    entry.points += result.points;
    days.set(result.day, entry);
  }
  const full = [...days].filter(([, entry]) => entry.done >= CHALLENGE_SLUGS.length).map(([played]) => played);
  const perfect = streakOf(full, day, STRICT_RULES);
  return {
    day,
    days,
    streak: streakOf(streakDays(results), day),
    perfect: { streak: perfect.streak, longest: perfect.longest, days: full.length },
  };
}

/** The same, as a hook that follows the saves and the clock. Browser only. */
export function useDailyRecord(): DailyRecord {
  const day = useDayNumber();
  const results = useDailyResults();
  return useMemo(() => dailyRecordOf(results, day), [results, day]);
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
