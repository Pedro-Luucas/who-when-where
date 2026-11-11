import { streaks } from "@/lib/stats";
import type { GameSave } from "../platform/types";
import type { Score } from "@/lib/points";
import { fewestBetween, isOver, isPlayable, isSolved, puzzleForDay, scoreOf, type Puzzle } from "./rules";

export type DayRecord = Puzzle & { guesses: string[] };

export type Save = GameSave<DayRecord>;

/** The day's crossing and the guesses made on it, from the save or freshly dealt. */
export function puzzleOf(save: Save, day: number): { puzzle: Puzzle; guesses: string[] } {
  // A saved record names its two ends, so a change to the map can't reassign it.
  const record = save.days[day];
  if (record && isPlayable(record)) {
    return { puzzle: { from: record.from, to: record.to }, guesses: record.guesses };
  }
  return { puzzle: puzzleForDay(day), guesses: [] };
}

/** A finished day's score, or null while it is still being played. */
export function resultOf(record: DayRecord): Score | null {
  if (!isPlayable(record)) return null;
  const score = scoreOf(record, record.guesses);
  return score.over ? score : null;
}

export type Stats = {
  played: number;
  /** Percentage of crossings completed. */
  arrivedRate: number;
  /** Crossings made in the fewest countries possible. */
  shortest: number;
  streak: number;
  longestStreak: number;
};

export function computeStats(save: Save, today: number): Stats {
  const finished = Object.entries(save.days).filter(
    ([, record]) => isPlayable(record) && isOver(record, record.guesses),
  );
  const arrived = finished.filter(([, record]) => isSolved(record, record.guesses));
  // A streak is a run of days on which the crossing was completed.
  const { streak, longest } = streaks(
    arrived.map(([day]) => Number(day)),
    today,
  );
  return {
    played: finished.length,
    arrivedRate: finished.length ? Math.round((arrived.length / finished.length) * 100) : 0,
    shortest: arrived.filter(([, record]) => record.guesses.length === fewestBetween(record)).length,
    streak,
    longestStreak: longest,
  };
}
