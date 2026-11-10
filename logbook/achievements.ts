import { activityOf, type DailyResult } from "@/games/results";
import { GAME_SLUGS, type GameSlug } from "@/games/slugs";
import { MAX_POINTS } from "@/lib/points";
import { streaks } from "@/lib/stats";

// Achievements are worked out from the finished daily puzzles saved on the
// device (games/results.ts) — nothing is stored but which ones the player has
// already been told about. Their names are in messages.ts (ach_<id>).

/** What the achievements are measured against. */
type Facts = {
  results: DailyResult[];
  /** Points and puzzles of the player's best day. */
  bestDay: { points: number; puzzles: number };
  longestStreak: number;
};

export type Achievement = {
  id: string;
  /** A few characters stamped on the badge. */
  mark: string;
  /** How much of `count` it takes; 1 when it is a thing done once. */
  goal: number;
  count: (facts: Facts) => number;
};

const total = (facts: Facts) => facts.results.reduce((sum, result) => sum + result.points, 0);

/** 1 once any result passes the test. */
const once = (test: (result: DailyResult) => boolean) => (facts: Facts) => (facts.results.some(test) ? 1 : 0);

const inGame = (game: GameSlug, test: (result: DailyResult) => boolean) =>
  once((result) => result.game === game && test(result));

/** Solved at the first try: "1/6". */
const firstTry = (result: DailyResult) => result.detail.startsWith("1/");

/** Solved with the very last try allowed: "6/6", but not a game with a single try. */
function lastTry(result: DailyResult): boolean {
  const [used, allowed] = result.detail.split("/").map(Number);
  return Number.isInteger(used) && used === allowed && allowed > 1;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", mark: "1", goal: 1, count: (facts) => facts.results.length },
  {
    id: "allrounder",
    mark: "A–Z",
    goal: GAME_SLUGS.length,
    count: (facts) => new Set(facts.results.map((result) => result.game)).size,
  },
  { id: "tour", mark: `${GAME_SLUGS.length}/${GAME_SLUGS.length}`, goal: GAME_SLUGS.length, count: (facts) => facts.bestDay.puzzles },
  { id: "streak3", mark: "3d", goal: 3, count: (facts) => facts.longestStreak },
  { id: "streak7", mark: "7d", goal: 7, count: (facts) => facts.longestStreak },
  { id: "streak30", mark: "30d", goal: 30, count: (facts) => facts.longestStreak },
  { id: "puzzles10", mark: "10", goal: 10, count: (facts) => facts.results.length },
  { id: "puzzles50", mark: "50", goal: 50, count: (facts) => facts.results.length },
  { id: "puzzles100", mark: "100", goal: 100, count: (facts) => facts.results.length },
  { id: "puzzles365", mark: "365", goal: 365, count: (facts) => facts.results.length },
  { id: "points10k", mark: "10k", goal: 10_000, count: total },
  { id: "points100k", mark: "100k", goal: 100_000, count: total },
  { id: "perfect", mark: "1000", goal: 1, count: once((result) => result.points >= MAX_POINTS) },
  { id: "day5000", mark: "5k", goal: 5000, count: (facts) => facts.bestDay.points },
  { id: "whisker", mark: "!", goal: 1, count: once(lastTry) },
  { id: "biographer", mark: "WW", goal: 1, count: inGame("who-when-where", (result) => result.points >= 900) },
  { id: "pathfinder", mark: "Wf", goal: 1, count: inGame("wayfarer", firstTry) },
  { id: "dowser", mark: "DS", goal: 1, count: inGame("dig-site", firstTry) },
  { id: "chronicler", mark: "FL", goal: 1, count: inGame("first-to-last", firstTry) },
  { id: "beeline", mark: "Ov", goal: 1, count: inGame("overland", (result) => result.points >= MAX_POINTS) },
  { id: "firstsight", mark: "Ou", goal: 1, count: inGame("outline", firstTry) },
];

export type Standing = {
  achievement: Achievement;
  /** How far along, never more than the goal. */
  count: number;
  unlocked: boolean;
};

/** Where the player stands on every achievement. `today` is today's puzzle number. */
export function standingsOf(results: DailyResult[], today: number): Standing[] {
  const activity = activityOf(results);
  const facts: Facts = {
    results,
    bestDay: {
      points: Math.max(0, ...activity.map((day) => day.points)),
      puzzles: Math.max(0, ...activity.map((day) => day.puzzles)),
    },
    longestStreak: streaks(
      activity.map((day) => day.day),
      today,
    ).longest,
  };
  return ACHIEVEMENTS.map((achievement) => {
    const count = Math.min(achievement.count(facts), achievement.goal);
    return { achievement, count, unlocked: count >= achievement.goal };
  });
}
