import { seededRandom } from "@/lib/daily";
import type { LatLon } from "@/lib/geo";
import type { Localized } from "@/lib/i18n";
import { MAX_POINTS, type Score } from "@/lib/points";
import { defineSetData, pickOne } from "../engines/kit";
import { PASS } from "../engines/rules";
import raw from "./data/features.json";
import { definition } from "./definition";

// Rivers & Ranges without its interface. A puzzle is three features — great
// rivers and mountain ranges — each played in two stages:
//
//   name      the feature is drawn on the map; name it in up to three guesses
//             (every miss shows a hint: the continent, then the first letter)
//   countries name the countries it passes through; each wrong one is a
//             strike, and three strikes (or every country found) end the stage
//
// Moves are flat over the whole puzzle: "f:<feature id>" names the feature,
// "c:<iso>" names a country, PASS gives up the stage being played. A country
// in the feature's wider basin (the Nile's reaches Tanzania) is neither right
// nor a strike. scripts/build-rivers.mjs builds data/features.json.

export type Kind = "river" | "range";
export type Continent = "africa" | "asia" | "europe" | "north-america" | "south-america" | "oceania";

export type Feature = {
  id: string;
  kind: Kind;
  name: Localized;
  also?: string[];
  continent: Continent;
  /** Lines of [lon, lat]: a river's course, a range's outline. */
  lines: [number, number][][];
  countries: string[];
  /** Countries close enough not to cost a strike: the basin, the foothills. */
  basin?: string[];
  lengthKm?: number;
};

export type Puzzle = { features: Feature[] };
export type Move = string;

export const FEATURES = raw as Feature[];
const byId = new Map(FEATURES.map((feature) => [feature.id, feature]));
export const featureById = (id: string) => byId.get(id);
export const RIVERS = FEATURES.filter((feature) => feature.kind === "river");
export const RANGES = FEATURES.filter((feature) => feature.kind === "range");

/** The continents, for the hint after a miss (the shell's region names live with the heavier geo data). */
export const CONTINENT_NAMES: Record<Continent, Localized> = {
  africa: { en: "Africa", pt: "África" },
  asia: { en: "Asia", pt: "Ásia" },
  europe: { en: "Europe", pt: "Europa" },
  "north-america": { en: "North America", pt: "América do Norte" },
  "south-america": { en: "South America", pt: "América do Sul" },
  oceania: { en: "Oceania", pt: "Oceania" },
};

export const NAME_GUESSES = 3;
export const STRIKES = 3;
/** Naming a feature on the first, second or third guess. */
export const NAME_POINTS = [500, 350, 200] as const;
/** Every country it passes through, found: shared out evenly. */
export const COUNTRY_POINTS = 500;

export const nameMove = (id: string): Move => `f:${id}`;
export const countryMove = (iso: string): Move => `c:${iso}`;

export type Stage = "name" | "countries" | "done";

export type Leg = {
  feature: Feature;
  stage: Stage;
  /** Feature ids guessed, in order. */
  guesses: string[];
  named: boolean;
  /** The naming stage was given up rather than guessed out. */
  passedName: boolean;
  /** Countries on its course, named. */
  found: string[];
  /** Countries of its basin named: no strike, no points. */
  near: string[];
  /** Countries named that it doesn't reach: the strikes. */
  wrong: string[];
  /** Every country named, in order, with how it went. */
  log: { iso: string; verdict: "hit" | "near" | "miss" }[];
  /** The countries stage was given up ("Done" or giving up the puzzle). */
  passedCountries: boolean;
  namePoints: number;
  /** Unrounded, so the three legs add up to the puzzle's points exactly. */
  countryShare: number;
  /** What the leg earned, out of 1,000. */
  points: number;
};

export type Walk = {
  legs: Leg[];
  /** The leg being played: legs.length once it is over. */
  at: number;
  /** Legs finished. */
  done: number;
  over: boolean;
  points: number;
};

const freshLeg = (feature: Feature): Leg => ({
  feature,
  stage: "name",
  guesses: [],
  named: false,
  passedName: false,
  found: [],
  near: [],
  wrong: [],
  log: [],
  passedCountries: false,
  namePoints: 0,
  countryShare: 0,
  points: 0,
});

/** How a puzzle stands after `moves`: what the board shows and the score is made of. */
export function walk(puzzle: Puzzle, moves: readonly Move[]): Walk {
  const legs = puzzle.features.map(freshLeg);
  let at = 0;
  for (const move of moves) {
    const leg = legs[at];
    if (!leg) break;
    const { feature } = leg;
    if (leg.stage === "name") {
      if (move === PASS) {
        leg.passedName = true;
        leg.stage = "countries";
      } else if (move.startsWith("f:")) {
        const id = move.slice(2);
        if (leg.guesses.includes(id)) continue;
        leg.guesses.push(id);
        if (id === feature.id) leg.named = true;
        if (leg.named || leg.guesses.length >= NAME_GUESSES) leg.stage = "countries";
      }
    } else if (leg.stage === "countries") {
      if (move === PASS) {
        leg.passedCountries = true;
        leg.stage = "done";
      } else if (move.startsWith("c:")) {
        const iso = move.slice(2);
        if (!iso || leg.found.includes(iso) || leg.near.includes(iso) || leg.wrong.includes(iso)) continue;
        const verdict = feature.countries.includes(iso) ? "hit" : feature.basin?.includes(iso) ? "near" : "miss";
        (verdict === "hit" ? leg.found : verdict === "near" ? leg.near : leg.wrong).push(iso);
        leg.log.push({ iso, verdict });
        if (leg.found.length >= feature.countries.length || leg.wrong.length >= STRIKES) leg.stage = "done";
      }
    }
    if (leg.stage === "done") at++;
  }
  for (const leg of legs) {
    leg.namePoints = leg.named ? NAME_POINTS[leg.guesses.length - 1] : 0;
    leg.countryShare = leg.feature.countries.length ? (COUNTRY_POINTS * leg.found.length) / leg.feature.countries.length : 0;
    leg.points = Math.round(leg.namePoints + leg.countryShare);
  }
  const total = legs.reduce((sum, leg) => sum + leg.namePoints + leg.countryShare, 0);
  return {
    legs,
    at,
    done: at,
    over: at >= legs.length,
    points: legs.length ? Math.round(total / legs.length) : 0,
  };
}

/** The PASSes that end the puzzle from here: one per stage still to play. */
export function passesToEnd(state: Walk): Move[] {
  const stages = state.legs.reduce((sum, leg) => sum + (leg.stage === "name" ? 2 : leg.stage === "countries" ? 1 : 0), 0);
  return Array.from({ length: stages }, () => PASS);
}

export function scoreOf(puzzle: Puzzle, moves: readonly Move[]): Score {
  const state = walk(puzzle, moves);
  return { over: state.over, points: state.points, detail: String(state.points) };
}

/** How a finished leg reads: right, close, wrong, or given up without a try. */
export function legVerdict(leg: Leg): "hit" | "near" | "miss" | "skip" {
  if (!leg.guesses.length && !leg.found.length && !leg.near.length && !leg.wrong.length) return "skip";
  const share = leg.points / MAX_POINTS;
  return share >= 0.85 ? "hit" : share >= 0.4 ? "near" : "miss";
}

/** Two corners framing a feature on the map (its middle, if it spanned the antimeridian). */
export function frameOf(feature: Feature): LatLon[] {
  const points = feature.lines.flat();
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  if (east - west > 180) return [{ lat: (south + north) / 2, lon: points[0][0] }];
  return [
    { lat: south, lon: west },
    { lat: north, lon: east },
  ];
}

// ── Dealing ─────────────────────────────────────────────────────────────────

/** Two rivers and a range, each from a different continent, in a shuffled order. */
function dealThree(seed: string): Puzzle {
  const random = seededRandom(seed);
  const range = pickOne(RANGES, random);
  const used = new Set<Continent>([range.continent]);
  const picks: Feature[] = [range];
  for (let i = 0; i < 2; i++) {
    const open = RIVERS.filter((river) => !used.has(river.continent) && !picks.includes(river));
    const river = pickOne(open.length ? open : RIVERS.filter((r) => !picks.includes(r)), random);
    used.add(river.continent);
    picks.push(river);
  }
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return { features: picks };
}

function fromIds(ids: string[]): Puzzle | undefined {
  if (!ids.length || new Set(ids).size !== ids.length) return undefined;
  const features = ids.map(featureById);
  return features.every((feature): feature is Feature => !!feature) ? { features } : undefined;
}

export default defineSetData<Puzzle, Move>(definition.slug, {
  forDay: (day) => dealThree(`${definition.slug}:day:${day}`),
  deal: (seed) => dealThree(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (puzzle) => puzzle.features.map((feature) => feature.id),
  score: (puzzle, moves) => scoreOf(puzzle, moves),
  answer: (puzzle, locale) => puzzle.features.map((feature) => feature.name[locale]).join(" · "),
});
