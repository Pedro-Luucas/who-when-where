import { streakOf } from "./streak";

/**
 * The current and longest streak over the puzzle numbers a player has
 * finished, by the site's one streak rule (lib/streak.ts).
 */
export function streaks(days: number[], today: number): { streak: number; longest: number } {
  const { streak, longest } = streakOf(days, today);
  return { streak, longest };
}
