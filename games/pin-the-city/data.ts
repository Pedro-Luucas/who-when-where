import { seededShuffle } from "@/lib/daily";
import { distanceKm } from "@/lib/geo";
import { CITIES, cityById, type City } from "@/lib/geo-data";
import { defineSetData } from "../engines/kit";
import { inSet, isRegionSet, type RegionSet } from "../engines/regions";
import { PASS, closeness, isPinMove, roundsScore, walkRounds, type Judged, type PinMove } from "../engines/rules";
import { definition } from "./definition";

// Pin the City without its interface: ten cities, one pin each, scored by
// how far it landed. The daily round is the world's big cities and capitals;
// practice can stay on one continent, with a stricter scale.

export const ROUNDS = 10;

export type Puzzle = { set: RegionSet; cities: City[] };
export type Move = PinMove | typeof PASS;

/** Full marks within this many km; the scale is the distance that keeps about a third. */
const EXACT_KM = 25;
const SCALE_KM: Record<RegionSet, number> = { world: 700, europe: 300, asia: 500, africa: 450, americas: 500, oceania: 450 };

/** The cities each set deals from: the bigger ones, so they are fair to ask. */
function poolOf(set: RegionSet): City[] {
  const inside = CITIES.filter((city) => inSet(city.country, set));
  return set === "world" ? inside.filter((city) => city.pop >= 2_000_000 || city.capital) : inside.slice(0, 160);
}

const POOLS = new Map<RegionSet, City[]>();
const pool = (set: RegionSet) => {
  let cities = POOLS.get(set);
  if (!cities) POOLS.set(set, (cities = poolOf(set)));
  return cities;
};

function dealCities(seed: string, set: RegionSet): Puzzle {
  const cities: City[] = [];
  for (const city of seededShuffle(pool(set), seed)) {
    // Two cities of the same round are never next door to each other.
    if (cities.every((other) => distanceKm(other, city) > 150)) cities.push(city);
    if (cities.length === ROUNDS) break;
  }
  return { set, cities };
}

export function judge(puzzle: Puzzle, round: number, move: Move): Judged & { km: number } {
  if (!isPinMove(move)) return { hit: false, share: 0, km: Infinity };
  const km = distanceKm({ lat: move[0], lon: move[1] }, puzzle.cities[round]);
  return { hit: false, share: closeness(km, EXACT_KM, SCALE_KM[puzzle.set]), km };
}

export const walkOf = (puzzle: Puzzle, moves: Move[]) =>
  walkRounds(puzzle.cities.length, moves, 1, (round, move) => judge(puzzle, round, move));

function fromIds(ids: string[]): Puzzle | undefined {
  const [first, ...rest] = ids;
  const set = first?.startsWith("~") ? first.slice(1) : "world";
  const cities = (first?.startsWith("~") ? rest : ids).map(cityById);
  if (!isRegionSet(set) || !cities.length || cities.some((city) => city === undefined)) return undefined;
  return { set, cities: cities as City[] };
}

export default defineSetData<Puzzle, Move>(definition.slug, {
  forDay: (day) => dealCities(`${definition.slug}:day:${day}`, "world"),
  deal: (seed, variant) => dealCities(`${definition.slug}:${seed}`, isRegionSet(variant) ? variant : "world"),
  fromIds,
  idsOf: (puzzle) => [...(puzzle.set === "world" ? [] : [`~${puzzle.set}`]), ...puzzle.cities.map((city) => city.id)],
  score(puzzle, moves) {
    const walk = walkOf(puzzle, moves);
    return roundsScore(walk.shares, puzzle.cities.length, walk.over);
  },
  answer: (puzzle, locale) => puzzle.cities[0]?.name[locale] ?? "",
});
