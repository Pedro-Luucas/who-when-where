import { useSyncExternalStore } from "react";

// Weeks, for the leagues and the Weekly Special. A week runs Monday to Sunday
// in UTC, like the days (lib/daily.ts): week 1 began on Monday 9 Nov 2026,
// the day before day 1. The accounts API says the same (api/src/days.ts).

const DAY_MS = 86_400_000;
const LAUNCH_UTC = Date.UTC(2026, 10, 10); // day 1

/** The week a puzzle day falls in. */
export const weekOfDay = (day: number): number => Math.floor(day / 7) + 1;

/** When a week ends: 00:00 UTC on the Monday after it. */
export const weekEndsAt = (week: number): number => LAUNCH_UTC + (7 * week - 1) * DAY_MS;

/** The first day of a week (Monday), at 00:00 UTC. */
export const weekStartsAt = (week: number): number => weekEndsAt(week) - 7 * DAY_MS;

/** "3d 4h", "5h 12m", "9m": how long until `at`. */
export function timeLeft(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((at - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes % 60}m`;
}

/** Now, to the minute, ticking once a minute; 0 before the page is live (server render). */
export function useMinute(): number {
  return useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, 60_000);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  );
}
