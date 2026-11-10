"use client";

import { streaks } from "@/lib/stats";
import { usePersistent } from "@/lib/storage";
import { isFound, isOver, type Dig } from "./rules";

export type DayRecord = { siteId: string; digs: Dig[] };

export type Save = {
  days: Record<string, DayRecord>;
  seenHelp: boolean;
};

const KEY = "dig-site:v1";
const EMPTY: Save = { days: {}, seenHelp: false };

export function useSave() {
  return usePersistent<Save>(KEY, EMPTY);
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
