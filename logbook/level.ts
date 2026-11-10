// A player's level: every point earned in a daily puzzle is a point of
// experience, and each level asks for a little more than the last.

/** Points from level 1 to level 2; each later level takes STEP_GROWTH more. */
const FIRST_STEP = 2000;
const STEP_GROWTH = 1000;

const stepFrom = (level: number): number => FIRST_STEP + STEP_GROWTH * (level - 1);

export type Level = {
  level: number;
  /** Points earned since reaching this level, and how many the next one takes. */
  into: number;
  step: number;
  /** Index into RANKS: the title held at this level. */
  rank: number;
};

/** The level at which each title is earned, lowest first. Their names are in messages.ts (rank0…). */
export const RANKS = [1, 3, 5, 8, 12, 16, 20, 25] as const;

export function levelOf(points: number): Level {
  let level = 1;
  let into = Math.max(0, Math.floor(points));
  while (into >= stepFrom(level)) {
    into -= stepFrom(level);
    level++;
  }
  return { level, into, step: stepFrom(level), rank: RANKS.findLastIndex((from) => level >= from) };
}
