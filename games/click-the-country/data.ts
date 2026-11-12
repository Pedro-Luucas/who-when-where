import { seededShuffle } from "@/lib/daily";
import { COUNTRIES, countryById, type Country } from "@/lib/countries";
import { defineSetData } from "../engines/kit";
import { inSet, isRegionSet, type RegionSet } from "../engines/regions";
import { roundsScore, walkRounds, type Judged } from "../engines/rules";
import { definition } from "./definition";

// Click the Country without its interface: ten countries to find on the map,
// a few tries each. The first try earns the most; a country never found earns
// nothing. The daily round leaves out the tiniest countries.

export const ROUNDS = 10;
export const MAX_TRIES = 3;

export type Puzzle = { set: RegionSet; countries: Country[] };
/** A country's ISO code, or PASS. */
export type Move = string;

/** What finding it on each try is worth. */
const SHARES = [1, 0.6, 0.3];

/** The daily round asks for countries of at least this size. */
const DAILY_MIN_KM2 = 25_000;

export function judge(puzzle: Puzzle, round: number, move: Move, attempt: number, tries = MAX_TRIES): Judged {
  const hit = move === puzzle.countries[round]?.id;
  // With fewer tries the scale is squeezed, so the last one still earns something.
  const share = SHARES[Math.min(SHARES.length - 1, Math.round((attempt * (SHARES.length - 1)) / Math.max(tries - 1, 1)))];
  return { hit, share: hit ? share : 0 };
}

export const walkOf = (puzzle: Puzzle, moves: Move[], tries = MAX_TRIES) =>
  walkRounds(puzzle.countries.length, moves, tries, (round, move, attempt) => judge(puzzle, round, move, attempt, tries));

function dealCountries(seed: string, set: RegionSet, daily: boolean): Puzzle {
  const pool = COUNTRIES.filter((country) => inSet(country.id, set) && (!daily || country.area >= DAILY_MIN_KM2));
  return { set, countries: seededShuffle(pool, seed).slice(0, ROUNDS) };
}

function fromIds(ids: string[]): Puzzle | undefined {
  const [first, ...rest] = ids;
  const set = first?.startsWith("~") ? first.slice(1) : "world";
  const countries = (first?.startsWith("~") ? rest : ids).map(countryById);
  if (!isRegionSet(set) || !countries.length || countries.some((country) => country === undefined)) return undefined;
  return { set, countries: countries as Country[] };
}

export default defineSetData<Puzzle, Move>(definition.slug, {
  forDay: (day) => dealCountries(`${definition.slug}:day:${day}`, "world", true),
  deal: (seed, variant) => dealCountries(`${definition.slug}:${seed}`, isRegionSet(variant) ? variant : "world", false),
  fromIds,
  idsOf: (puzzle) => [...(puzzle.set === "world" ? [] : [`~${puzzle.set}`]), ...puzzle.countries.map((country) => country.id)],
  score(puzzle, moves, tries) {
    const walk = walkOf(puzzle, moves, tries);
    return roundsScore(walk.shares, puzzle.countries.length, walk.over);
  },
  answer: (puzzle, locale) => puzzle.countries[0]?.name[locale] ?? "",
  discover: (puzzle, day) =>
    puzzle.countries.map((country) => ({ kind: "country", id: country.id, day, name: country.name, place: country, country })),
});
