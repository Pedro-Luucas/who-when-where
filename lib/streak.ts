// The one streak rule of the whole site: the daily page, the home dashboard,
// every game's statistics, the logbook and the public profiles all count a
// streak this way. The accounts API runs the very same function
// (api/src/days.ts), and its tests check the two agree day for day.
//
// Kept free of imports, so the API's tests can load this file as it is.
//
// • A streak is a run of UTC days (lib/daily.ts) with a puzzle finished.
// • Today never breaks it: the day is not over until 00:00 UTC.
// • A missed day spends a freeze, if one is held, and the run goes on (the
//   frozen day itself adds nothing). With none left, the run is over.
// • Everybody starts with one freeze and earns another for every 7 days
//   played in a run, holding at most MAX at a time (a later plan may hold more).

export type StreakRules = {
  /** Freezes held before the first day is played. */
  startFreezes: number;
  /** Days played in a run that earn one more freeze. */
  earnEvery: number;
  /** The most freezes held at a time. */
  maxFreezes: number;
};

export const STREAK_RULES: StreakRules = { startFreezes: 1, earnEvery: 7, maxFreezes: 1 };

/** No freezes: every missed day ends the run (the "perfect days" streak). */
export const STRICT_RULES: StreakRules = { startFreezes: 0, earnEvery: 0, maxFreezes: 0 };

export type Streak = {
  /** Days played in the current run (0 once it is broken). */
  streak: number;
  /** The longest run ever. */
  longest: number;
  /** Freezes held now. */
  freezes: number;
  /** The days of the current run that a freeze saved. */
  frozen: number[];
  /** Whether today is already played. */
  playedToday: boolean;
};

/** The streak over the days a player finished something, as it stands on `today`. */
export function streakOf(days: Iterable<number>, today: number, rules: StreakRules = STREAK_RULES): Streak {
  const played = new Set<number>();
  let first = Infinity;
  for (const day of days) {
    // Days to come (a clock running ahead) and nonsense count for nothing.
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
