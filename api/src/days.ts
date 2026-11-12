// The puzzle calendar, as the server sees it. A "day" is a UTC calendar day,
// for everybody (the site's lib/daily.ts says the same): day 1 is 10 Nov 2026,
// and the next puzzles arrive at 00:00 UTC.
//
// Pages from before the switch to UTC days numbered a day by the player's own
// local date, so for a while a page left open may still send the number of a
// day that has begun somewhere east of here: results are taken up to
// latestDay(), the newest day anyone's clock can show.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const LAUNCH_UTC = Date.UTC(2026, 10, 10); // day 1: 10 Nov 2026

/** Today's puzzle number: the UTC day. */
export function utcDay(now = Date.now()): number {
  return Math.floor((now - LAUNCH_UTC) / DAY_MS) + 1;
}

/** The newest puzzle a page may report (local clocks run up to UTC+14). */
export function latestDay(now = Date.now()): number {
  return utcDay(now + 14 * HOUR_MS);
}

/** The oldest puzzle that is still "today" on some local clock (down to UTC−12). */
export function earliestDay(now = Date.now()): number {
  return utcDay(now - 12 * HOUR_MS);
}

// ── Streaks ─────────────────────────────────────────────────────────────────
// The site's one streak rule, word for word (lib/streak.ts): the tests run
// both on the same days and check they agree.
//
// • A streak is a run of UTC days with one of the dailies finished.
// • Today never breaks it: the day is not over until 00:00 UTC.
// • A missed day spends a freeze, if one is held, and the run goes on (the
//   frozen day itself adds nothing). With none left, the run is over.
// • Everybody starts with one freeze and earns another for every 7 days
//   played in a run, holding at most maxFreezes at a time.

export type StreakRules = { startFreezes: number; earnEvery: number; maxFreezes: number };

export const STREAK_RULES: StreakRules = { startFreezes: 1, earnEvery: 7, maxFreezes: 1 };

export type Streak = { streak: number; longest: number; freezes: number; frozen: number[]; playedToday: boolean };

export function streakOf(days: Iterable<number>, today: number, rules: StreakRules = STREAK_RULES): Streak {
  const played = new Set<number>();
  let first = Infinity;
  for (const day of days) {
    if (!Number.isInteger(day) || day < 1 || day > today) continue;
    played.add(day);
    if (day < first) first = day;
  }

  let streak = 0;
  let longest = 0;
  let freezes = rules.startFreezes;
  let frozen: number[] = [];
  let sinceEarned = 0;

  for (let day = first; day <= today; day++) {
    if (played.has(day)) {
      streak++;
      longest = Math.max(longest, streak);
      if (rules.earnEvery > 0 && ++sinceEarned >= rules.earnEvery) {
        sinceEarned = 0;
        freezes = Math.min(rules.maxFreezes, freezes + 1);
      }
    } else if (day === today) {
      // Still time to play.
    } else if (streak > 0 && freezes > 0) {
      freezes--;
      frozen.push(day);
    } else {
      streak = 0;
      frozen = [];
      sinceEarned = 0;
    }
  }

  return { streak, longest, freezes, frozen, playedToday: played.has(today) };
}

/** The streak over the days a player finished one of the dailies, as it stands now. */
export function streaks(days: number[], now = Date.now()): { streak: number; longest: number; freezes: number } {
  const { streak, longest, freezes } = streakOf(days, utcDay(now));
  return { streak, longest, freezes };
}
