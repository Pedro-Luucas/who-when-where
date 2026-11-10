"use client";

import { streaks } from "@/lib/stats";
import { usePersistent } from "@/lib/storage";
import { PUZZLE_SIZE, eventById, eventsForDay, type HistoryEvent } from "./events";
import { isOver, isSolved, truthOf, type Attempt } from "./rules";

/** `ids` are the day's events in lettered order, so a pool change can't reshuffle a saved day. */
export type DayRecord = { ids: string[]; attempts: Attempt[] };

export type Save = {
  days: Record<string, DayRecord>;
  seenHelp: boolean;
};

const KEY = "first-to-last:v1";
const EMPTY: Save = { days: {}, seenHelp: false };

export function useSave() {
  return usePersistent<Save>(KEY, EMPTY);
}

/** The day's events and the attempts made on them, from the save or freshly dealt. */
export function puzzleOf(save: Save, day: number): { events: HistoryEvent[]; attempts: Attempt[] } {
  const record = save.days[day];
  if (record) {
    const events = record.ids.map(eventById);
    if (events.length === PUZZLE_SIZE && events.every((event) => event !== undefined)) {
      return { events: events as HistoryEvent[], attempts: record.attempts };
    }
  }
  return { events: eventsForDay(day), attempts: [] };
}

export type Stats = {
  played: number;
  /** Percentage of puzzles put in order within the allowed attempts. */
  solvedRate: number;
  /** Puzzles put in order at the first attempt. */
  flawless: number;
  streak: number;
  longestStreak: number;
};

export function computeStats(save: Save, today: number): Stats {
  const days = Object.keys(save.days).map((day) => ({ day: Number(day), ...puzzleOf(save, Number(day)) }));
  const finished = days.filter(({ events, attempts }) => isOver(attempts, truthOf(events)));
  const solved = finished.filter(({ events, attempts }) => isSolved(attempts, truthOf(events)));
  // A streak is a run of days on which the order was found.
  const { streak, longest } = streaks(
    solved.map(({ day }) => day),
    today,
  );
  return {
    played: finished.length,
    solvedRate: finished.length ? Math.round((solved.length / finished.length) * 100) : 0,
    flawless: solved.filter(({ attempts }) => attempts.length === 1).length,
    streak,
    longestStreak: longest,
  };
}
