import { seededRandom } from "@/lib/daily";
import { COUNTRIES, countryById, type Country } from "@/lib/countries";
import { MAX_POINTS, type Score } from "@/lib/points";
import { defineSetData, pickOne } from "../engines/kit";
import { PASS } from "../engines/rules";
import { definition } from "./definition";

// Border Chain without its interface: a start, a target, and the land
// borders between them. Each move names a country; one that borders the end
// of the chain (and isn't in it yet) joins it, any other is a miss. BACK
// takes the last country off the chain. The chain is done when it reaches the
// target; every move counts, so the shortest way scores best.

export type Puzzle = { from: Country; to: Country; shortest: number };
export type Move = string;

/** Takes the last country off the chain. */
export const BACK = "<";
/** Moves allowed beyond the shortest way. */
export const SPARE = 6;
/** The daily target is this many borders away, at least and at most. */
const MIN_STEPS = 3;
const MAX_STEPS = 6;

const neighbours = (id: string): readonly string[] => countryById(id)?.borders ?? [];

/** Borders crossed from `from` to every country it can reach by land. */
export function distancesFrom(from: string): Map<string, number> {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of neighbours(id)) {
      if (!seen.has(next)) {
        seen.set(next, seen.get(id)! + 1);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** One shortest way from `from` to `to`, both included. */
export function shortestPath(from: string, to: string): string[] {
  const distances = distancesFrom(to);
  const path = [from];
  let at = from;
  while (at !== to) {
    const step = neighbours(at).find((next) => distances.get(next) === (distances.get(at) ?? Infinity) - 1);
    if (!step) return [];
    path.push(step);
    at = step;
  }
  return path;
}

export const borders = (a: string, b: string) => neighbours(a).includes(b);

export type Walk = {
  /** The countries of the chain, the start first. */
  chain: string[];
  /** Each move and what it did. */
  log: { move: Move; result: "joined" | "miss" | "back" | "pass" }[];
  reached: boolean;
  over: boolean;
  /** Moves made, misses and backs included. */
  used: number;
};

export function walkOf(puzzle: Puzzle, moves: readonly Move[]): Walk {
  const chain = [puzzle.from.id];
  const log: Walk["log"] = [];
  const budget = puzzle.shortest + SPARE;
  let over = false;
  for (const move of moves) {
    if (over) break;
    if (move === PASS) {
      log.push({ move, result: "pass" });
      over = true;
      break;
    }
    if (move === BACK) {
      if (chain.length > 1) chain.pop();
      log.push({ move, result: "back" });
    } else if (borders(chain.at(-1)!, move) && !chain.includes(move)) {
      chain.push(move);
      log.push({ move, result: "joined" });
    } else log.push({ move, result: "miss" });
    if (chain.at(-1) === puzzle.to.id || log.length >= budget) over = true;
  }
  const reached = chain.at(-1) === puzzle.to.id;
  return { chain, log, reached, over, used: log.filter((entry) => entry.result !== "pass").length };
}

/** The most a chain that never arrived can earn, for getting close. */
const CLOSE_POINTS = 250;

export function scoreOf(puzzle: Puzzle, moves: Move[]): Score {
  const walk = walkOf(puzzle, moves);
  if (walk.reached) {
    return {
      over: true,
      points: Math.round((MAX_POINTS * puzzle.shortest) / Math.max(walk.used, puzzle.shortest)),
      detail: `${walk.used}/${puzzle.shortest}`,
    };
  }
  const left = distancesFrom(puzzle.to.id).get(walk.chain.at(-1)!) ?? puzzle.shortest;
  const closer = Math.max(0, puzzle.shortest - left);
  return { over: walk.over, points: walk.over ? Math.round((CLOSE_POINTS * closer) / puzzle.shortest) : 0, detail: "X" };
}

/** The countries in the big land masses: the ones a chain can start from. */
const LINKED = COUNTRIES.filter((country) => distancesFrom(country.id).size >= 10);

function dealPair(seed: string): Puzzle {
  const random = seededRandom(seed);
  for (let attempt = 0; attempt < 50; attempt++) {
    const from = pickOne(LINKED, random);
    const far = [...distancesFrom(from.id)].filter(([, steps]) => steps >= MIN_STEPS && steps <= MAX_STEPS);
    if (!far.length) continue;
    const [id, shortest] = pickOne(far, random);
    return { from, to: countryById(id)!, shortest };
  }
  return { from: countryById("pt")!, to: countryById("pl")!, shortest: 4 };
}

function fromIds([from, to]: string[]): Puzzle | undefined {
  const a = from === undefined ? undefined : countryById(from);
  const b = to === undefined ? undefined : countryById(to);
  if (!a || !b) return undefined;
  const shortest = distancesFrom(a.id).get(b.id);
  return shortest === undefined || shortest < 1 ? undefined : { from: a, to: b, shortest };
}

export default defineSetData<Puzzle, Move>(definition.slug, {
  forDay: (day) => dealPair(`${definition.slug}:day:${day}`),
  deal: (seed) => dealPair(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (puzzle) => [puzzle.from.id, puzzle.to.id],
  score: scoreOf,
  answer: (puzzle, locale) =>
    shortestPath(puzzle.from.id, puzzle.to.id)
      .map((id) => countryById(id)?.name[locale] ?? id)
      .join(" → "),
  discover: (puzzle, day) => {
    const path = shortestPath(puzzle.from.id, puzzle.to.id).flatMap((id) => countryById(id) ?? []);
    return path.length
      ? [
          {
            kind: "crossing",
            id: `chain:${puzzle.from.id}-${puzzle.to.id}`,
            day,
            name: { en: `${puzzle.from.name.en} → ${puzzle.to.name.en}`, pt: `${puzzle.from.name.pt} → ${puzzle.to.name.pt}` },
            place: puzzle.from,
            route: path.map((country) => ({ lat: country.lat, lon: country.lon })),
          },
        ]
      : [];
  },
});
