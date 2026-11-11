"use client";

import { countryById } from "@/lib/countries";
import { streaks } from "@/lib/stats";
import { saveShape, type SyncedSave } from "@/lib/saves";
import { usePersistent } from "@/lib/storage";
import type { Score } from "@/lib/points";
import { isOver, isSolved, scoreOf } from "./rules";

export type DayRecord = { countryId: string; guesses: string[] };

export type Save = {
  days: Record<string, DayRecord>;
  seenHelp: boolean;
};

const KEY = "outline:v1";

/** How a signed-in player's days are copied to their account. */
export const SYNC: SyncedSave = { game: "outline", key: KEY, progressField: "guesses" };

const VALID = saveShape(SYNC.progressField);
const EMPTY: Save = { days: {}, seenHelp: false };

export function useSave() {
  return usePersistent<Save>(KEY, EMPTY, VALID);
}

/** A finished day's score, or null while it is still being played. */
export function resultOf(record: DayRecord): Score | null {
  if (!countryById(record.countryId)) return null;
  const score = scoreOf(record.countryId, record.guesses);
  return score.over ? score : null;
}

export type Stats = {
  played: number;
  /** Percentage of countries named. */
  solvedRate: number;
  /** Average number of guesses, over the puzzles that were solved. */
  averageGuesses: number;
  streak: number;
  longestStreak: number;
};

export function computeStats(save: Save, today: number): Stats {
  const finished = Object.entries(save.days).filter(([, record]) => isOver(record.countryId, record.guesses));
  const solved = finished.filter(([, record]) => isSolved(record.countryId, record.guesses));
  // A streak is a run of days on which the country was named.
  const { streak, longest } = streaks(
    solved.map(([day]) => Number(day)),
    today,
  );
  const guesses = solved.reduce((sum, [, record]) => sum + record.guesses.length, 0);
  return {
    played: finished.length,
    solvedRate: finished.length ? Math.round((solved.length / finished.length) * 100) : 0,
    averageGuesses: solved.length ? Math.round((guesses / solved.length) * 10) / 10 : 0,
    streak,
    longestStreak: longest,
  };
}
