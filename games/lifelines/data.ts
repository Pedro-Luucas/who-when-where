import { seededRandom, seededShuffle } from "@/lib/daily";
import { formatYear } from "@/lib/i18n";
import { NOTABLES, notableById, type Notable } from "@/lib/notables";
import { defineSetData, pickOne } from "../engines/kit";
import { orderScore, type OrderAttempt } from "../engines/rules";
import { definition } from "./definition";

// Lifelines without its interface: five people to put in birth order. They
// are drawn from a few centuries around one of them, so the order is a real
// question rather than "the ancient Greek goes first".

export const SIZE = 5;
export const MAX_TRIES = 3;

/** The people in the order they are lettered. */
export type Puzzle = Notable[];

/** Births closer than this are never in the same puzzle: the order must be a fair question. */
const MIN_YEARS_APART = 3;
/** The windows tried around the first person, narrowest first. */
const WINDOWS = [120, 250, 500, 5000];

const POOL = NOTABLES.filter((person) => person.fame >= 50);

export const truthOf = (people: Puzzle): string[] =>
  [...people].sort((a, b) => a.born.year - b.born.year).map((person) => person.id);

function dealPeople(seed: string): Puzzle {
  const random = seededRandom(seed);
  for (let attempt = 0; attempt < 20; attempt++) {
    const anchor = pickOne(POOL, random);
    for (const window of WINDOWS) {
      const near = seededShuffle(
        POOL.filter((person) => person.id !== anchor.id && Math.abs(person.born.year - anchor.born.year) <= window),
        `${seed}:${attempt}:${window}`,
      );
      const chosen = [anchor];
      for (const person of near) {
        if (chosen.every((other) => Math.abs(other.born.year - person.born.year) >= MIN_YEARS_APART)) chosen.push(person);
        if (chosen.length === SIZE) break;
      }
      if (chosen.length === SIZE) return seededShuffle(chosen, `${seed}:letters`);
    }
  }
  return POOL.slice(0, SIZE);
}

function fromIds(ids: string[]): Puzzle | undefined {
  const people = ids.map(notableById);
  if (people.length !== SIZE || people.some((person) => person === undefined)) return undefined;
  return people as Notable[];
}

export default defineSetData<Puzzle, OrderAttempt>(definition.slug, {
  forDay: (day) => dealPeople(`${definition.slug}:day:${day}`),
  deal: (seed) => dealPeople(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (people) => people.map((person) => person.id),
  score: (people, attempts, tries = MAX_TRIES) => orderScore(truthOf(people), attempts, tries),
  answer(people, locale) {
    const years = people.map((person) => person.born.year);
    return `${formatYear(Math.min(...years), locale)} → ${formatYear(Math.max(...years), locale)}`;
  },
});
