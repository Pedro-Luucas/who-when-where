"use client";

import { streaks } from "@/lib/stats";
import { saveShape, type SyncedSave } from "@/lib/saves";
import { usePersistent } from "@/lib/storage";
import type { Score } from "@/lib/points";
import { isFound, isOver, scoreOf, type Dig } from "./rules";

export type DayRecord = { siteId: string; digs: Dig[] };

export type Save = {
  days: Record<string, DayRecord>;
  seenHelp: boolean;
};

const KEY = "dig-site:v1";

/** How a signed-in player's days are copied to their account. */
export const SYNC: SyncedSave = { game: "dig-site", key: KEY, progressField: "digs" };

const VALID = saveShape(SYNC.progressField);
const EMPTY: Save = { days: {}, seenHelp: false };

export function useSave() {
  return usePersistent<Save>(KEY, EMPTY, VALID);
}

/** A finished day's score, or null while it is still being played. */
export function resultOf(record: DayRecord): Score | null {
  const score = scoreOf(record.digs);
  return score.over ? score : null;
}

export type Stats = {
  played: number;
  /** Percentage of puzzles where the site was found. */
  foundRate: number;
  /** Average number of digs it took, over the puzzles that were solved. */
  averageDigs: number;
  streak: number;
  longestStreak: number;
};

export function computeStats(save: Save, today: number): Stats {
  const finished = Object.entries(save.days).filter(([, record]) => isOver(record.digs));
  const found = finished.filter(([, record]) => isFound(record.digs));
  // A streak is a run of days on which the site was found.
  const { streak, longest } = streaks(
    found.map(([day]) => Number(day)),
    today,
  );
  const digs = found.reduce((sum, [, record]) => sum + record.digs.length, 0);
  return {
    played: finished.length,
    foundRate: finished.length ? Math.round((found.length / finished.length) * 100) : 0,
    averageDigs: found.length ? Math.round((digs / found.length) * 10) / 10 : 0,
    streak,
    longestStreak: longest,
  };
}
