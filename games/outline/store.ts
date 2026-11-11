import { countryById } from "@/lib/countries";
import { streaks } from "@/lib/stats";
import type { GameSave } from "../platform/types";
import type { Score } from "@/lib/points";
import { isOver, isSolved, scoreOf } from "./rules";

export type DayRecord = { countryId: string; guesses: string[] };

export type Save = GameSave<DayRecord>;

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
