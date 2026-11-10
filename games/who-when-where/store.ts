"use client";

import { usePersistent } from "@/lib/storage";
import { ROUNDS, totalScore, type Guess } from "./rules";

export type DayRecord = { personId: string; guesses: Guess[] };

export type Save = {
  days: Record<string, DayRecord>;
  seenHelp: boolean;
};

const KEY = "who-when-where:v1";
const EMPTY: Save = { days: {}, seenHelp: false };

export function useSave() {
  return usePersistent<Save>(KEY, EMPTY);
}

export const isComplete = (record: DayRecord | undefined): boolean =>
  !!record && record.guesses.length >= ROUNDS.length;

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

  let longestStreak = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const { day } of finished) {
    run = day === previous + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }
  // The streak survives until a whole day is missed.
  const streak = previous === today || previous === today - 1 ? run : 0;

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
