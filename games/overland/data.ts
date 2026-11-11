import { countryById, shortestRoute, type Country } from "@/lib/countries";
import { defineData } from "../platform/types";
import { definition } from "./definition";
import { isOver, isPlayable, puzzleForDay, puzzlesForSeed, scoreOf, type Puzzle } from "./rules";
import { resultOf, type DayRecord } from "./store";

/** Overland without its interface: the crossings, the scoring, what a finished one reveals. */
export default defineData<Puzzle, string, DayRecord>(definition.slug, {
  puzzleForDay,
  deal: (seed, count) => puzzlesForSeed(seed, count).map((puzzle) => [puzzle.from, puzzle.to]),
  puzzleOf([from, to]) {
    const puzzle = { from, to };
    return isPlayable(puzzle) ? puzzle : undefined;
  },
  // A saved record names its two ends, so a change to the map can't reassign it.
  puzzleOfRecord: (record) => (isPlayable(record) ? { from: record.from, to: record.to } : undefined),
  idsOf: (puzzle) => [puzzle.from, puzzle.to],
  recordOf: (puzzle, guesses) => ({ ...puzzle, guesses }),
  score: scoreOf,
  resultOf,
  answer: (puzzle, locale) => [puzzle.from, puzzle.to].map((id) => countryById(id)?.name[locale] ?? "").join(" → "),
  discover(record, day) {
    if (!isPlayable(record) || !isOver(record, record.guesses)) return [];
    const way = shortestRoute(record.from, record.to, new Set(record.guesses))
      .map((id) => countryById(id))
      .filter((country): country is Country => country !== undefined);
    const [from, to] = [way[0], way[way.length - 1]];
    if (!from || !to) return [];
    return [
      {
        kind: "crossing",
        id: `${from.id}-${to.id}`,
        day,
        name: { en: `${from.name.en} → ${to.name.en}`, pt: `${from.name.pt} → ${to.name.pt}` },
        place: from,
        route: way,
      },
    ];
  },
  totals: { crossing: null },
});
