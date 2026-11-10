/**
 * Streaks over the puzzle numbers a player has finished. The current streak
 * survives until a whole day is missed.
 */
export function streaks(days: number[], today: number): { streak: number; longest: number } {
  const sorted = [...days].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const day of sorted) {
    run = day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const streak = previous === today || previous === today - 1 ? run : 0;
  return { streak, longest };
}
