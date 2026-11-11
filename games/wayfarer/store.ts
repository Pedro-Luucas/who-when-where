"use client";

import { streaks } from "@/lib/stats";
import { saveShape, type SyncedSave } from "@/lib/saves";
import { usePersistent } from "@/lib/storage";
import type { Score } from "@/lib/points";
import { isOver, isSolved, scoreOf, type Guess } from "./rules";

export type DayRecord = { journeyId: string; guesses: Guess[] };

export type Save = {
  days: Record<string, DayRecord>;
  seenHelp: boolean;
};

const KEY = "wayfarer:v1";

/** How a signed-in player's days are copied to their account. */
export const SYNC: SyncedSave = { game: "wayfarer", key: KEY, progressField: "guesses" };

const VALID = saveShape(SYNC.progressField);
const EMPTY: Save = { days: {}, seenHelp: false };

export function useSave() {
  return usePersistent<Save>(KEY, EMPTY, VALID);
}

/** A finished day's score, or null while it is still being played. */
export function resultOf(record: DayRecord): Score | null {
  const score = scoreOf(record.journeyId, record.guesses);
  return score.over ? score : null;
}

export type Stats = {
  played: number;
  /** Percentage of puzzles solved. */
  solvedRate: number;
  /** Average number of tries, over the puzzles that were solved. */
  averageTries: number;
  streak: number;
  longestStreak: number;
};

export function computeStats(save: Save, today: number): Stats {
  const finished = Object.entries(save.days).filter(([, record]) =>
    isOver(record.journeyId, record.guesses),
  );
  const solved = finished.filter(([, record]) => isSolved(record.journeyId, record.guesses));
  // A streak is a run of days on which the journey was named.
  const { streak, longest } = streaks(
    solved.map(([day]) => Number(day)),
    today,
  );
  const tries = solved.reduce((sum, [, record]) => sum + record.guesses.length, 0);
  return {
    played: finished.length,
    solvedRate: finished.length ? Math.round((solved.length / finished.length) * 100) : 0,
    averageTries: solved.length ? Math.round((tries / solved.length) * 10) / 10 : 0,
    streak,
    longestStreak: longest,
  };
}
