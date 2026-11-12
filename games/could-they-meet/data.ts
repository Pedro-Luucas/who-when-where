import { seededRandom, seededShuffle } from "@/lib/daily";
import { NOTABLES, notableById, type Notable } from "@/lib/notables";
import { defineSetData, pickOne } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { definition } from "./definition";

// Could They Have Met? without its interface: ten pairs of people, half of
// whom were alive at the same time. The pairs are chosen close to the line —
// lives that overlapped by a few decades, or missed each other by a few — so
// the question is never obvious.

export const ROUNDS = 10;

export type Pair = [Notable, Notable];
export type Puzzle = { pairs: Pair[] };

/** Years between two lives: negative when they overlapped (minus the years both were alive). */
export const gapOf = (a: Notable, b: Notable): number =>
  Math.max(a.born.year, b.born.year) - Math.min(a.died.year, b.died.year);

export const metOf = ([a, b]: Pair): boolean => gapOf(a, b) < 0;

export const answersOf = (puzzle: Puzzle): string[] => puzzle.pairs.map((pair) => (metOf(pair) ? "yes" : "no"));

// Well-known enough to be a fair question.
const POOL = NOTABLES.filter((person) => person.fame >= 50);

/** A pair "yes" when they shared 2–35 years, "no" when 2–70 years apart; a year either side is never asked. */
const fits = (gap: number, want: "yes" | "no") => (want === "yes" ? gap <= -2 && gap >= -35 : gap >= 2 && gap <= 70);

function dealPairs(seed: string): Puzzle {
  const random = seededRandom(seed);
  const wants = seededShuffle(
    Array.from({ length: ROUNDS }, (_, i) => (i % 2 ? "yes" : "no") as "yes" | "no"),
    `${seed}:wants`,
  );
  const used = new Set<string>();
  const pairs: Pair[] = [];
  for (const want of wants) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = pickOne(POOL, random);
      if (used.has(a.id)) continue;
      const loose = attempt > 30;
      const options = POOL.filter((b) => {
        if (b.id === a.id || used.has(b.id)) return false;
        const gap = gapOf(a, b);
        return loose ? Math.abs(gap) >= 2 : fits(gap, want);
      });
      if (!options.length) continue;
      const b = pickOne(options, random);
      pairs.push(random() < 0.5 ? [a, b] : [b, a]);
      used.add(a.id).add(b.id);
      break;
    }
  }
  return { pairs };
}

function fromIds(ids: string[]): Puzzle | undefined {
  const pairs: Pair[] = [];
  for (const id of ids) {
    const [a, b] = id.split("+").map(notableById);
    if (!a || !b) return undefined;
    pairs.push([a, b]);
  }
  return pairs.length ? { pairs } : undefined;
}

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealPairs(`${definition.slug}:day:${day}`),
  deal: (seed) => dealPairs(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (puzzle) => puzzle.pairs.map(([a, b]) => `${a.id}+${b.id}`),
  score: (puzzle, moves) => pickScore(answersOf(puzzle), moves),
  answer: (puzzle, locale) => puzzle.pairs.map(([a, b]) => `${a.name[locale]} · ${b.name[locale]}`)[0] ?? "",
});
