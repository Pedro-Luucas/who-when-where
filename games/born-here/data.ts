import { seededRandom, seededShuffle } from "@/lib/daily";
import { distanceKm } from "@/lib/geo";
import { NOTABLES, notableById, type Notable } from "@/lib/notables";
import { defineSetData, pickOne } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { definition } from "./definition";

// Born Here without its interface: rounds of one birthplace and four people,
// one of whom was born there. The other three were born far away, so the
// map always decides it. Survival (practice) plays until the third miss.

export const ROUNDS = 10;
export const SURVIVAL_ROUNDS = 40;
export const SURVIVAL_LIVES = 3;
const SURVIVAL = "~survival";

/** The others in a round were born at least this far from the town. */
const MIN_KM_APART = 900;

export type Round = { answer: Notable; options: Notable[] };
export type Puzzle = { rounds: Round[]; lives?: number };

// Birthplaces that read as a town on the map, not a house, a fort or a county.
const NOT_A_TOWN =
  /\d|birthplace|homestead|monument|fort\b|rue |street|monasterio|paramountcy|empire|county|municipality|province|governorate|borough|parish|district|partido|^portugal$|^francia$|^florida$/i;

const PLAYABLE = NOTABLES.filter(
  (person) => person.fame >= 40 && person.born.place.country && !NOT_A_TOWN.test(person.born.place.name.en),
);

/** A round's id: the answer first, then the others. */
const roundId = (round: Round) => [round.answer, ...round.options.filter((p) => p.id !== round.answer.id)].map((p) => p.id).join(".");

function roundOf(id: string): Round | undefined {
  const people = id.split(".").map(notableById);
  if (people.length !== 4 || people.some((person) => person === undefined)) return undefined;
  const [answer] = people as Notable[];
  return { answer, options: seededShuffle(people as Notable[], id) };
}

function dealRounds(seed: string, count: number): Round[] {
  const random = seededRandom(seed);
  const used = new Set<string>();
  const rounds: Round[] = [];
  for (let attempt = 0; rounds.length < count && attempt < count * 5; attempt++) {
    const answer = pickOne(PLAYABLE, random);
    if (used.has(answer.id)) continue;
    const far = seededShuffle(
      PLAYABLE.filter(
        (other) =>
          other.id !== answer.id &&
          !used.has(other.id) &&
          distanceKm(other.born.place, answer.born.place) >= MIN_KM_APART,
      ),
      `${seed}:${attempt}`,
    ).slice(0, 3);
    if (far.length < 3) continue;
    for (const person of [answer, ...far]) used.add(person.id);
    const id = [answer, ...far].map((person) => person.id).join(".");
    rounds.push(roundOf(id)!);
  }
  return rounds;
}

export const answersOf = (puzzle: Puzzle) => puzzle.rounds.map((round) => round.answer.id);

function fromIds(ids: string[]): Puzzle | undefined {
  const survival = ids[0] === SURVIVAL;
  const rounds = (survival ? ids.slice(1) : ids).map(roundOf);
  if (!rounds.length || rounds.some((round) => round === undefined)) return undefined;
  return { rounds: rounds as Round[], lives: survival ? SURVIVAL_LIVES : undefined };
}

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => ({ rounds: dealRounds(`${definition.slug}:day:${day}`, ROUNDS) }),
  deal: (seed, variant) =>
    variant === "survival"
      ? { rounds: dealRounds(`${definition.slug}:${seed}`, SURVIVAL_ROUNDS), lives: SURVIVAL_LIVES }
      : { rounds: dealRounds(`${definition.slug}:${seed}`, ROUNDS) },
  fromIds,
  idsOf: (puzzle) => [...(puzzle.lives ? [SURVIVAL] : []), ...puzzle.rounds.map(roundId)],
  score: (puzzle, moves) => pickScore(answersOf(puzzle), moves, puzzle.lives),
  answer: (puzzle, locale) => puzzle.rounds[0]?.answer.born.place.name[locale] ?? "",
});
