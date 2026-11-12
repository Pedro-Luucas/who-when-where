import { seededRandom, seededShuffle } from "@/lib/daily";
import type { Localized } from "@/lib/i18n";
import { NOTABLES } from "@/lib/notables";
import { EVENTS } from "../first-to-last/events";
import { defineSetData, pickOne } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { definition } from "./definition";

// Same Year without its interface: rounds of four moments — events from
// First to Last, and the births and deaths of famous people — three of which
// share a year. The odd one is from a few years either side, so the round is
// about knowing, not about telling centuries apart.

export const ROUNDS = 10;

export type Moment = { id: string; year: number; name: Localized; person?: string };
export type Round = { odd: Moment; options: Moment[] };
export type Puzzle = Round[];

const MOMENTS: Moment[] = [
  ...EVENTS.filter((event) => !event.circa).map((event) => ({ id: `e:${event.id}`, year: event.year, name: event.name })),
  ...NOTABLES.filter((person) => person.fame >= 40).flatMap((person) => [
    {
      id: `b:${person.id}`,
      year: person.born.year,
      name: { en: `${person.name.en} is born`, pt: `Nasce ${person.name.pt}` },
      person: person.id,
    },
    {
      id: `d:${person.id}`,
      year: person.died.year,
      name: { en: `${person.name.en} dies`, pt: `Morre ${person.name.pt}` },
      person: person.id,
    },
  ]),
];

const byId = new Map(MOMENTS.map((moment) => [moment.id, moment]));
const byYear = new Map<number, Moment[]>();
for (const moment of MOMENTS) byYear.set(moment.year, [...(byYear.get(moment.year) ?? []), moment]);

/** No two moments of a round are about the same person. */
const apart = (moments: Moment[], next: Moment) => !next.person || moments.every((moment) => moment.person !== next.person);

/** Three moments of `year` about three different people (or events), if it has them. */
function threeOf(year: number, random: () => number): Moment[] | null {
  const chosen: Moment[] = [];
  for (const moment of seededShuffle(byYear.get(year) ?? [], String(random()))) {
    if (apart(chosen, moment)) chosen.push(moment);
    if (chosen.length === 3) return chosen;
  }
  return null;
}

const YEARS = [...byYear.keys()].filter((year) => threeOf(year, () => 0.5) !== null);

/** The odd one is this many years away, at least and at most. */
const ODD_MIN = 2;
const ODD_MAX = 30;

function roundOf(id: string): Round | undefined {
  const moments = id.split("|").map((part) => byId.get(part));
  if (moments.length !== 4 || moments.some((moment) => moment === undefined)) return undefined;
  const [odd, ...same] = moments as Moment[];
  if (odd.year === same[0].year || same.some((moment) => moment.year !== same[0].year)) return undefined;
  return { odd, options: seededShuffle(moments as Moment[], id) };
}

function dealRounds(seed: string): Puzzle {
  const random = seededRandom(seed);
  const years = seededShuffle(YEARS, seed);
  const rounds: Round[] = [];
  const used = new Set<string>();
  for (const year of years) {
    if (rounds.length === ROUNDS) break;
    const same = threeOf(year, random);
    if (!same || same.some((moment) => used.has(moment.id))) continue;
    const odds = MOMENTS.filter((moment) => {
      const gap = Math.abs(moment.year - year);
      return gap >= ODD_MIN && gap <= ODD_MAX && !used.has(moment.id) && same.every((other) => apart([other], moment));
    });
    if (!odds.length) continue;
    const odd = pickOne(odds, random);
    for (const moment of [odd, ...same]) used.add(moment.id);
    rounds.push(roundOf([odd, ...same].map((moment) => moment.id).join("|"))!);
  }
  return rounds;
}

export const answersOf = (puzzle: Puzzle) => puzzle.map((round) => round.odd.id);

/** The year three of a round's moments share. */
export const sharedYear = (round: Round) => round.options.find((moment) => moment.id !== round.odd.id)!.year;

function fromIds(ids: string[]): Puzzle | undefined {
  const rounds = ids.map(roundOf);
  if (!rounds.length || rounds.some((round) => round === undefined)) return undefined;
  return rounds as Round[];
}

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealRounds(`${definition.slug}:day:${day}`),
  deal: (seed) => dealRounds(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (puzzle) =>
    puzzle.map((round) => [round.odd, ...round.options.filter((moment) => moment.id !== round.odd.id)].map((moment) => moment.id).join("|")),
  score: (puzzle, moves) => pickScore(answersOf(puzzle), moves),
  answer: (puzzle, locale) => puzzle[0]?.odd.name[locale] ?? "",
});
