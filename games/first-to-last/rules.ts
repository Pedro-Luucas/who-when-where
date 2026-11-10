import { chronological, type HistoryEvent } from "./events";

export const MAX_ATTEMPTS = 3;

/** One submitted order: event ids, earliest first. */
export type Attempt = string[];

/** The right answer for a set of events. */
export const truthOf = (events: HistoryEvent[]): string[] =>
  chronological(events).map((event) => event.id);

/** How many events of an attempt sit in the right position. */
export const inPlace = (attempt: Attempt, truth: string[]): number =>
  attempt.filter((id, i) => id === truth[i]).length;

export const isSolved = (attempts: Attempt[], truth: string[]): boolean => {
  const last = attempts[attempts.length - 1];
  return !!last && inPlace(last, truth) === truth.length;
};

export const isOver = (attempts: Attempt[], truth: string[]): boolean =>
  isSolved(attempts, truth) || attempts.length >= MAX_ATTEMPTS;
