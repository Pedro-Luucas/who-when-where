import { COUNTRIES, type Country } from "@/lib/countries";
import { MAX_POINTS, type Score } from "@/lib/points";
import { defineSetData } from "../engines/kit";
import { inSet, isRegionSet, type RegionSet } from "../engines/regions";
import { PASS } from "../engines/rules";
import { definition } from "./definition";

// Type the Countries without its interface: every country of a set, and a
// clock. The first move starts the clock ("@" and the time it started, so a
// reload carries on where it was); every other move is a country named; the
// run ends when the clock runs out (the board adds a PASS) or every country
// is named. The daily run is the whole world in eight minutes.

export type Puzzle = { set: RegionSet; countries: Country[]; seconds: number };
export type Move = string;

const SECONDS: Record<RegionSet, number> = { world: 480, europe: 240, asia: 240, africa: 300, americas: 180, oceania: 120 };

export const START = "@";
export const startMove = (now: number): Move => `${START}${Math.round(now)}`;

/** When the clock started (ms since 1970), the countries named so far, and whether the run is over. */
export function tally(puzzle: Puzzle, moves: readonly Move[]): { started: number | null; found: string[]; over: boolean } {
  const first = moves[0];
  const started = first?.startsWith(START) ? Number(first.slice(1)) || null : null;
  const ids = new Set(puzzle.countries.map((country) => country.id));
  const found: string[] = [];
  let over = false;
  for (const move of moves) {
    if (move === PASS) over = true;
    else if (!over && ids.has(move) && !found.includes(move)) found.push(move);
  }
  return { started, found, over: over || found.length === ids.size };
}

export function scoreOf(puzzle: Puzzle, moves: Move[]): Score {
  const { found, over } = tally(puzzle, moves);
  const total = puzzle.countries.length;
  return { over, points: Math.round((MAX_POINTS * found.length) / total), detail: `${found.length}/${total}` };
}

const puzzleOf = (set: RegionSet): Puzzle => ({
  set,
  countries: COUNTRIES.filter((country) => inSet(country.id, set)),
  seconds: SECONDS[set],
});

export default defineSetData<Puzzle, Move>(definition.slug, {
  forDay: () => puzzleOf("world"),
  deal: (_, variant) => puzzleOf(isRegionSet(variant) ? variant : "world"),
  fromIds: ([set]) => (isRegionSet(set) ? puzzleOf(set) : undefined),
  idsOf: (puzzle) => [puzzle.set],
  score: scoreOf,
  answer: (puzzle, locale) => `${puzzle.countries.length} ${locale === "pt" ? "países" : "countries"}`,
  discover: () => [],
});
