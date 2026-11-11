import { streaks } from "@/lib/stats";
import type { GameSave } from "../platform/types";
import type { Score } from "@/lib/points";
import { isOver, isSolved, scoreOf, type Guess } from "./rules";

export type DayRecord = { journeyId: string; guesses: Guess[] };

export type Save = GameSave<DayRecord>;

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
  // A streak is a run of days with the puzzle finished, solved or not: the one rule
  // every game, the daily challenge and the accounts API share.
  const { streak, longest } = streaks(
    finished.map(([day]) => Number(day)),
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
