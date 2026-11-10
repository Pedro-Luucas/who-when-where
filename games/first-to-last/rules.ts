import { triesPoints, type Score } from "@/lib/points";
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

export const isOver = (attempts: Attempt[], truth: string[], max = MAX_ATTEMPTS): boolean =>
  isSolved(attempts, truth) || attempts.length >= max;

/** An order never found still earns this much per event left in its place. */
const IN_PLACE_POINTS = 25;

/** How a puzzle stands, on the scale every game shares. */
export function scoreOf(events: HistoryEvent[], attempts: Attempt[], max = MAX_ATTEMPTS): Score {
  const truth = truthOf(events);
  const solved = isSolved(attempts, truth);
  const last = attempts[attempts.length - 1];
  return {
    over: isOver(attempts, truth, max),
    points: solved ? triesPoints(attempts.length, max) : last ? IN_PLACE_POINTS * inPlace(last, truth) : 0,
    detail: `${solved ? attempts.length : "X"}/${max}`,
  };
}
