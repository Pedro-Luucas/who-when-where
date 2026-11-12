import { countryById, type Country } from "@/lib/countries";
import { seededRandom, seededShuffle } from "@/lib/daily";
import { defineSetData } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { definition } from "./definition";
import sizes from "./data/sizes.json";

// True Size without its interface. A puzzle is six pairs of countries; each
// pair is two Pick rounds: which of the two is really bigger, then by how
// much (three bands). The question shows the pair as the familiar web map
// (Mercator) draws them, where land far from the equator looks swollen; the
// answer shows them at true scale.
//
// The sizes (games/true-size/data/sizes.json, scripts/build-true-size.mjs)
// are those of the land the board draws, from the same world map.

export type Size = {
  /** km² of the land drawn: the mainland and what lies near it. */
  area: number;
  /** How big the web map makes that land look, in km² as they would be at the equator. */
  merc: number;
  /** Where the projections are centred. */
  lat: number;
  lon: number;
  region: string;
  /** The pieces of the country's shapes left out (far-flung islands, overseas lands). */
  drop?: number[];
};

export type Entry = { country: Country; size: Size };
export type Pair = { a: Entry; b: Entry };
/** Six pairs, in the order they come up. */
export type Puzzle = Pair[];

export const PAIRS = 6;

/** The answers to "how many times bigger": under 1.5×, 1.5× to 3×, over 3×. */
export const BANDS = ["low", "mid", "high"] as const;
export type Band = (typeof BANDS)[number];
const EDGES = [1.5, 3];
/** A pair never has a ratio this close (8%) to the edge of a band. */
const EDGE_MARGIN = 1.08;
const MIN_RATIO = 1.15;
const MAX_RATIO = 8;
/** In a tricky pair, the smaller country looks at least this much bigger on the web map. */
const TRICKY_LOOK = 1.3;
/** In a fair pair, the bigger country is also swollen at least this much more than the other. */
const FAIR_SWELL = 1.3;
/** No continent more than this many times in a puzzle. */
const PER_REGION = 4;
/** The far north the web map swells the most (four times and more) comes up at most twice a puzzle. */
const FAR_NORTH = 4;
const FAR_NORTH_PER_PUZZLE = 2;

const SIZES = sizes as Record<string, Size>;

const POOL: Entry[] = Object.entries(SIZES)
  .map(([id, size]) => ({ country: countryById(id), size }))
  .filter((entry): entry is Entry => entry.country !== undefined);

const byId = new Map(POOL.map((entry) => [entry.country.id, entry]));

export const biggerOf = (pair: Pair): Entry => (pair.a.size.area >= pair.b.size.area ? pair.a : pair.b);
export const smallerOf = (pair: Pair): Entry => (pair.a.size.area >= pair.b.size.area ? pair.b : pair.a);
/** How many times bigger the bigger one is. */
export const ratioOf = (pair: Pair): number => biggerOf(pair).size.area / smallerOf(pair).size.area;

export const bandOf = (ratio: number): Band => (ratio < EDGES[0] ? "low" : ratio < EDGES[1] ? "mid" : "high");

/** The right answer of each round: the bigger country's id, then the band. */
export const answersOf = (puzzle: Puzzle): string[] =>
  puzzle.flatMap((pair) => [biggerOf(pair).country.id, bandOf(ratioOf(pair))]);

/** The web map makes the smaller one look bigger. */
export const isTricky = (pair: Pair): boolean => smallerOf(pair).size.merc > biggerOf(pair).size.merc;

const swell = (entry: Entry) => entry.size.merc / entry.size.area;

function fits(a: Entry, b: Entry): "tricky" | "fair" | null {
  const big = a.size.area >= b.size.area ? a : b;
  const small = big === a ? b : a;
  const ratio = big.size.area / small.size.area;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) return null;
  if (EDGES.some((edge) => ratio > edge / EDGE_MARGIN && ratio < edge * EDGE_MARGIN)) return null;
  if (small.size.merc >= TRICKY_LOOK * big.size.merc) return "tricky";
  if (swell(big) >= FAIR_SWELL * swell(small)) return "fair";
  return null;
}

type Kind = "tricky" | "fair";

/** For each kind, each country's possible partners: worked out once. */
const PARTNERS = (() => {
  const kinds: Record<Kind, Map<string, Entry[]>> = { tricky: new Map(), fair: new Map() };
  const add = (kind: Kind, a: Entry, b: Entry) => {
    const list = kinds[kind].get(a.country.id) ?? [];
    list.push(b);
    kinds[kind].set(a.country.id, list);
  };
  POOL.forEach((a, i) => {
    for (const b of POOL.slice(i + 1)) {
      const kind = fits(a, b);
      if (kind) {
        add(kind, a, b);
        add(kind, b, a);
      }
    }
  });
  return kinds;
})();

function dealPairs(seed: string): Puzzle {
  const random = seededRandom(`${seed}:sides`);
  const used = new Set<string>();
  const regions = new Map<string, number>();
  let farNorth = 0;
  // Countries are drawn first and their partners after, so a country with
  // many possible partners comes up no more often than one with few.
  const take = (kind: Kind, count: number, strict: boolean): [Entry, Entry][] => {
    const taken: [Entry, Entry][] = [];
    const perRegion = strict ? PER_REGION : PAIRS * 2;
    const fitsIn = (a: Entry, b: Entry) => {
      if (used.has(b.country.id)) return false;
      const extra = (region: string) =>
        (regions.get(region) ?? 0) + (a.size.region === region ? 1 : 0) + (b.size.region === region ? 1 : 0);
      if (extra(a.size.region) > perRegion || extra(b.size.region) > perRegion) return false;
      const north = [a, b].filter((entry) => swell(entry) >= FAR_NORTH).length;
      return !strict || farNorth + north <= FAR_NORTH_PER_PUZZLE;
    };
    for (const a of seededShuffle(POOL, `${seed}:${kind}:${strict}`)) {
      if (taken.length >= count) break;
      if (used.has(a.country.id)) continue;
      const partners = PARTNERS[kind].get(a.country.id) ?? [];
      const b = seededShuffle(partners, `${seed}:${kind}:${a.country.id}`).find((partner) => fitsIn(a, partner));
      if (!b) continue;
      for (const entry of [a, b]) {
        used.add(entry.country.id);
        regions.set(entry.size.region, (regions.get(entry.size.region) ?? 0) + 1);
        if (swell(entry) >= FAR_NORTH) farNorth++;
      }
      taken.push([a, b]);
    }
    return taken;
  };
  const half = PAIRS / 2;
  const tricky = take("tricky", half, true);
  const fair = take("fair", half, true);
  // Should the continents run short, the rest come from anywhere.
  tricky.push(...take("tricky", half - tricky.length, false));
  fair.push(...take("fair", PAIRS - tricky.length - fair.length, false));
  const order = seededShuffle([...tricky, ...fair], `${seed}:order`);
  return order.map(([a, b]) => (random() < 0.5 ? { a, b } : { a: b, b: a }));
}

function fromIds(ids: string[]): Puzzle | undefined {
  if (ids.length < 2 || ids.length % 2 !== 0) return undefined;
  const entries = ids.map((id) => byId.get(id));
  if (entries.some((entry) => entry === undefined)) return undefined;
  const pairs: Puzzle = [];
  for (let i = 0; i < entries.length; i += 2) pairs.push({ a: entries[i]!, b: entries[i + 1]! });
  return pairs;
}

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealPairs(`${definition.slug}:day:${day}`),
  deal: (seed) => dealPairs(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (puzzle) => puzzle.flatMap((pair) => [pair.a.country.id, pair.b.country.id]),
  score: (puzzle, moves) => pickScore(answersOf(puzzle), moves),
  answer: (puzzle, locale) => {
    const first = puzzle[0];
    return first ? `${first.a.country.name[locale]} · ${first.b.country.name[locale]}` : "";
  },
});
