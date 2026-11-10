"use client";

import { streaks } from "@/lib/stats";
import type { SyncedSave } from "@/lib/saves";
import { usePersistent } from "@/lib/storage";
import type { Score } from "@/lib/points";
import { ROUNDS, scoreOf, totalScore, type Guess } from "./rules";

export type DayRecord = { personId: string; guesses: Guess[] };

export type Save = {
  days: Record<string, DayRecord>;
  seenHelp: boolean;
};

const KEY = "who-when-where:v1";

/** How a signed-in player's days are copied to their account. */
export const SYNC: SyncedSave = { game: "who-when-where", key: KEY, progressField: "guesses" };

const EMPTY: Save = { days: {}, seenHelp: false };

export function useSave() {
  return usePersistent<Save>(KEY, EMPTY);
}

export const isComplete = (record: DayRecord | undefined): boolean =>
  !!record && record.guesses.length >= ROUNDS.length;

/** A finished day's score, or null while it is still being played. */
export function resultOf(record: DayRecord): Score | null {
  const score = scoreOf(record.guesses);
  return score.over ? score : null;
}

export type Stats = {
  played: number;
  average: number;
  best: number;
  streak: number;
  longestStreak: number;
};

export function computeStats(save: Save, today: number): Stats {
  const finished = Object.entries(save.days)
    .filter(([, record]) => isComplete(record))
    .map(([day, record]) => ({ day: Number(day), score: totalScore(record.guesses) }))
    .sort((a, b) => a.day - b.day);

  const { streak, longest: longestStreak } = streaks(
    finished.map((entry) => entry.day),
    today,
  );

  const scores = finished.map((entry) => entry.score);
  return {
    played: scores.length,
    average: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0,
    best: scores.length ? Math.max(...scores) : 0,
    streak,
    longestStreak,
  };
}
