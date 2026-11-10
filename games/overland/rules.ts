import { COUNTRIES, countryById, isConnected, stepsFrom } from "@/lib/countries";
import { dailyIndex, seededShuffle } from "@/lib/daily";
import { triesPoints, type Score } from "@/lib/points";

/** Two countries to join overland. */
export type Puzzle = { from: string; to: string };

/** Guesses allowed beyond the fewest that could do it. */
export const SPARE = 4;

// A crossing is worth playing when the ends are easy to find on the map and
// a handful of countries lie between them.
const MIN_AREA_KM2 = 15_000;
const MIN_BETWEEN = 2;
const MAX_BETWEEN = 6;

/** The countries a puzzle is played with: every one that has a land border. */
export const BORDERED = COUNTRIES.filter((country) => country.borders.length > 0);

let pool: Puzzle[] | null = null;

/** Every crossing worth playing, in a fixed order. */
function puzzles(): Puzzle[] {
  if (pool) return pool;
  const ends = BORDERED.filter((country) => country.area >= MIN_AREA_KM2);
  pool = [];
  for (const from of ends) {
    const steps = stepsFrom(from.id);
    for (const to of ends) {
      const between = (steps.get(to.id) ?? 0) - 1;
      if (from.id !== to.id && between >= MIN_BETWEEN && between <= MAX_BETWEEN) {
        pool.push({ from: from.id, to: to.id });
      }
    }
  }
  return pool;
}

// The day's crossing is asked for on every render and the pool is long:
// remember the last answer.
let dealt: { day: number; puzzle: Puzzle } | null = null;

export function puzzleForDay(day: number): Puzzle {
  if (dealt?.day !== day) {
    const all = puzzles();
    dealt = { day, puzzle: all[dailyIndex(all.length, day, "overland")] };
  }
  return dealt.puzzle;
}

/** `count` crossings, always the same for the same seed. */
export function puzzlesForSeed(seed: string, count: number): Puzzle[] {
  return seededShuffle(puzzles(), seed).slice(0, count);
}

/** Whether both ends exist and can be joined overland. */
export const isPlayable = (puzzle: Puzzle): boolean =>
  !!countryById(puzzle.from) && (stepsFrom(puzzle.from).get(puzzle.to) ?? 0) > 1;

/** The fewest countries that join the two ends. */
export const fewestBetween = (puzzle: Puzzle): number => (stepsFrom(puzzle.from).get(puzzle.to) ?? 1) - 1;

export const maxGuesses = (puzzle: Puzzle, spare = SPARE): number => fewestBetween(puzzle) + spare;

/**
 * How far out of the way a country is: 0 when a shortest route passes through
 * it, otherwise the borders it adds to the trip. Infinity when it can't be
 * reached overland at all.
 */
export function detourOf(puzzle: Puzzle, id: string): number {
  const there = stepsFrom(puzzle.from).get(id);
  const onwards = stepsFrom(puzzle.to).get(id);
  if (there === undefined || onwards === undefined) return Infinity;
  return there + onwards - (fewestBetween(puzzle) + 1);
}

/** on: a shortest route passes through it · near: one border out of the way · off: further. */
export type Verdict = "on" | "near" | "off";

export function verdictOf(puzzle: Puzzle, id: string): Verdict {
  const detour = detourOf(puzzle, id);
  return detour === 0 ? "on" : detour === 1 ? "near" : "off";
}

export const isSolved = (puzzle: Puzzle, guesses: string[]): boolean =>
  isConnected(puzzle.from, puzzle.to, new Set(guesses));

export const isOver = (puzzle: Puzzle, guesses: string[], spare = SPARE): boolean =>
  isSolved(puzzle, guesses) || guesses.length >= maxGuesses(puzzle, spare);

// A crossing left unfinished still earns a little for each country on the way.
const ON_THE_WAY_POINTS = 40;
const UNFINISHED_MAX = 150;

/** How a puzzle stands, on the scale every game shares. */
export function scoreOf(puzzle: Puzzle, guesses: string[], spare = SPARE): Score {
  const solved = isSolved(puzzle, guesses);
  const wasted = guesses.length - fewestBetween(puzzle);
  const onTheWay = guesses.filter((id) => verdictOf(puzzle, id) === "on").length;
  return {
    over: isOver(puzzle, guesses, spare),
    points: solved
      ? triesPoints(Math.max(wasted, 0) + 1, spare + 1)
      : Math.min(ON_THE_WAY_POINTS * onTheWay, UNFINISHED_MAX),
    detail: `${solved ? guesses.length : "X"}/${maxGuesses(puzzle, spare)}`,
  };
}
