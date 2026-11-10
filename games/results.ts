"use client";

import { useSyncExternalStore } from "react";
import type { Score } from "@/lib/points";
import { readStore, subscribeToStore } from "@/lib/storage";
import * as digSite from "./dig-site/store";
import type { GameSlug } from "./slugs";
import * as firstToLast from "./first-to-last/store";
import * as wayfarer from "./wayfarer/store";
import * as whoWhenWhere from "./who-when-where/store";

// Every game's finished days, read on one scale (lib/points.ts). This is what
// the daily challenge, the activity graph and the leaderboards are built on.

/** A finished daily puzzle. */
export type DailyResult = { game: GameSlug; day: number; points: number; detail: string };

type Source = {
  game: GameSlug;
  /** The save's key in lib/storage. */
  key: string;
  /** A saved day's score, or null while it is unfinished. */
  resultOf: (record: never) => Score | null;
};

const SOURCES: Source[] = [
  { game: "who-when-where", key: whoWhenWhere.SYNC.key, resultOf: whoWhenWhere.resultOf },
  { game: "wayfarer", key: wayfarer.SYNC.key, resultOf: wayfarer.resultOf },
  { game: "dig-site", key: digSite.SYNC.key, resultOf: digSite.resultOf },
  { game: "first-to-last", key: firstToLast.SYNC.key, resultOf: firstToLast.resultOf },
];

type Save = { days?: Record<string, unknown> } | null;

const readSaves = (): Save[] => SOURCES.map((source) => readStore<Save>(source.key, null));

function resultsOf(saves: Save[]): DailyResult[] {
  const results: DailyResult[] = [];
  SOURCES.forEach(({ game, resultOf }, i) => {
    for (const [key, record] of Object.entries(saves[i]?.days ?? {})) {
      const day = Number(key);
      if (!Number.isInteger(day) || day < 1) continue;
      try {
        const score = resultOf(record as never);
        if (score) results.push({ game, day, points: score.points, detail: score.detail });
      } catch {
        // A save from an older version, or a damaged one: not a finished day.
      }
    }
  });
  return results;
}

// The saves are cached by lib/storage until they change, so the results can be too.
let cached: { saves: Save[]; results: DailyResult[] } | null = null;
const NONE: DailyResult[] = [];

/** Every finished daily puzzle saved on this device. Browser only. */
export function readDailyResults(): DailyResult[] {
  const saves = readSaves();
  if (!cached || saves.some((save, i) => save !== cached?.saves[i])) {
    cached = { saves, results: resultsOf(saves) };
  }
  return cached.results;
}

/** The same, as a hook that follows the saves. */
export function useDailyResults(): DailyResult[] {
  return useSyncExternalStore(subscribeToStore, readDailyResults, () => NONE);
}

/** What was played on each day: how many puzzles, and for how many points. */
export type DayActivity = { day: number; puzzles: number; points: number };

export function activityOf(results: DailyResult[]): DayActivity[] {
  const days = new Map<number, DayActivity>();
  for (const { day, points } of results) {
    const entry = days.get(day) ?? { day, puzzles: 0, points: 0 };
    entry.puzzles++;
    entry.points += points;
    days.set(day, entry);
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}
