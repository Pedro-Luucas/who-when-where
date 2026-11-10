import type { Journey } from "./journeys";

export const MAX_GUESSES = 6;

/** Share of the route on the map before each guess (first, second, …). */
export const REVEAL = [0.15, 0.3, 0.48, 0.66, 0.84, 1];

// Extra clues unlock once this many guesses have been used.
export const MODE_CLUE_AT = 2;
export const CENTURY_CLUE_AT = 3;
export const NAMES_CLUE_AT = 4;

/** A journey id, or null for a skipped turn. */
export type Guess = string | null;

export const isSolved = (journeyId: string, guesses: Guess[]): boolean =>
  guesses[guesses.length - 1] === journeyId;

export const isOver = (journeyId: string, guesses: Guess[]): boolean =>
  isSolved(journeyId, guesses) || guesses.length >= MAX_GUESSES;

/**
 * What a wrong guess tells the player: whether the mystery journey set out
 * earlier (-1) or later (1) than the guessed one, and roughly by how much —
 * 0: within 25 years · 1: within a century · 2: within five · 3: more.
 */
export type Hint = { direction: -1 | 0 | 1; gap: 0 | 1 | 2 | 3 };

export function hintFor(guess: Journey, target: Journey): Hint {
  const years = target.start - guess.start;
  const apart = Math.abs(years);
  return {
    direction: Math.sign(years) as Hint["direction"],
    gap: apart <= 25 ? 0 : apart <= 100 ? 1 : apart <= 500 ? 2 : 3,
  };
}

/** 1519 → 16; -334 → -4 (4th century BC). */
export function centuryOf(year: number): number {
  return year > 0 ? Math.ceil(year / 100) : -Math.ceil(-year / 100);
}
