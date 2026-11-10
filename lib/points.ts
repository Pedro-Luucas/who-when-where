// One scale for every game, so scores can be added up and compared: a
// puzzle is worth up to 1,000 points, whatever the game.

export const MAX_POINTS = 1000;

/** Solving on the last try allowed still earns this much. */
const LAST_TRY_POINTS = 250;

/** How a puzzle stands: whether it is finished, what it earned, and the short result ("3/6"). */
export type Score = { over: boolean; points: number; detail: string };

/** Points for solving on try `n` of `max`: full marks for the first, down to 250 for the last. */
export function triesPoints(n: number, max: number): number {
  if (max <= 1) return MAX_POINTS;
  return Math.round(MAX_POINTS - ((n - 1) * (MAX_POINTS - LAST_TRY_POINTS)) / (max - 1));
}
