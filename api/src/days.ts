// The puzzle calendar, as the server sees it. A player's "day" is their own
// local date (see lib/daily.ts on the site), so at any instant two day
// numbers are being played somewhere in the world.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const LAUNCH_UTC = Date.UTC(2026, 10, 10); // day 1: 10 Nov 2026

/** Today's puzzle number for a player on UTC. */
export function utcDay(now = Date.now()): number {
  return Math.floor((now - LAUNCH_UTC) / DAY_MS) + 1;
}

/** The newest puzzle anyone can be playing (clocks run up to UTC+14). */
export function latestDay(now = Date.now()): number {
  return utcDay(now + 14 * HOUR_MS);
}

/** The oldest puzzle that is still "today" somewhere (clocks run down to UTC−12). */
export function earliestDay(now = Date.now()): number {
  return utcDay(now - 12 * HOUR_MS);
}

/**
 * Streaks over the puzzle numbers a player has finished: the current one
 * survives until a whole day is missed, whatever the player's time zone.
 */
export function streaks(days: number[], now = Date.now()): { streak: number; longest: number } {
  let longest = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const day of [...days].sort((a, b) => a - b)) {
    run = day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { streak: previous >= earliestDay(now) - 1 ? run : 0, longest };
}
