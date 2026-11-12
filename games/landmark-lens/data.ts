import type { ImageCreditData } from "@/components/image-credit";
import regions from "@/lib/data/regions.json";
import { seededRandom, seededShuffle } from "@/lib/daily";
import { distanceKm } from "@/lib/geo";
import type { Localized } from "@/lib/i18n";
import { defineSetData } from "../engines/kit";
import { PASS, roundsScore, walkRounds, type Judged } from "../engines/rules";
import { definition } from "./definition";
import landmarkData from "./data/landmarks.json";
import siteData from "./data/sites.json";

// Landmark Lens without its interface: five photos of famous places, one pin
// each. A round earns up to 0.8 for how close the pin landed and 0.2 more
// when it landed in the landmark's country.
//
//   data/landmarks.json  world-famous landmarks (Wikidata + Commons photos)
//   data/sites.json      Dig Site's sites with their photos
//
// Both are built by scripts/fetch-landmarks.mjs; don't edit them by hand.

export const ROUNDS = 5;

export type Photo = {
  src: string;
  width: number;
  height: number;
  credit?: ImageCreditData;
};

export type Landmark = {
  id: string;
  name: Localized;
  /** ISO 3166-1 alpha-2, lower case, as in lib/data/countries.json. */
  country: string;
  lat: number;
  lon: number;
  photos: Photo[];
};

/** A round: a landmark and which of its photos is shown. */
export type Round = { landmark: Landmark; photo: number };
export type Puzzle = { rounds: Round[] };

/** A pin and the country under it ("" for the sea), found when the pin was dropped so judging stays pure. */
export type PinCountryMove = [lat: number, lon: number, country: string];
export type Move = PinCountryMove | typeof PASS;

const regionOf = (country: string) =>
  (regions as Record<string, string>)[country];

type Pool = "landmark" | "site";
const playable = (entry: Landmark) =>
  entry.photos.length > 0 && regionOf(entry.country) !== undefined;
const LANDMARKS = (landmarkData as Landmark[]).filter(playable);
const SITES = (siteData as Landmark[]).filter(playable);
const POOL: { landmark: Landmark; pool: Pool }[] = [
  ...LANDMARKS.map((landmark) => ({ landmark, pool: "landmark" as const })),
  ...SITES.map((landmark) => ({ landmark, pool: "site" as const })),
];
const byId = new Map(POOL.map((entry) => [entry.landmark.id, entry.landmark]));

export const landmarkById = (id: string): Landmark | undefined => byId.get(id);

// ── Scoring ─────────────────────────────────────────────────────────────────

/** Full marks for the distance within this many km. */
export const EXACT_KM = 25;
/** A pin this close counts as in the right country, whatever the map says (a coast, an island, a border). */
const SAME_COUNTRY_KM = 50;
const DISTANCE_SHARE = 0.8;
const COUNTRY_SHARE = 0.2;

/**
 * How much of the distance part a pin `km` away keeps: a curve through
 * 25 km → 1, 100 km → 0.75, 500 km → 0.45, 2,000 km → 0.1 and nothing from
 * 6,000 km, straight between them on a log scale of the distance.
 */
const CURVE: [km: number, kept: number][] = [
  [EXACT_KM, 1],
  [100, 0.75],
  [500, 0.45],
  [2000, 0.1],
  [6000, 0],
];

export function nearness(km: number): number {
  if (!(km > CURVE[0][0])) return Number.isNaN(km) ? 0 : 1;
  for (let i = 1; i < CURVE.length; i++) {
    const [farKm, farKept] = CURVE[i];
    if (km <= farKm) {
      const [nearKm, nearKept] = CURVE[i - 1];
      const t = Math.log(km / nearKm) / Math.log(farKm / nearKm);
      return nearKept + (farKept - nearKept) * t;
    }
  }
  return 0;
}

export const isPinCountryMove = (move: unknown): move is PinCountryMove =>
  Array.isArray(move) &&
  move.length === 3 &&
  typeof move[0] === "number" &&
  typeof move[1] === "number" &&
  Number.isFinite(move[0]) &&
  Number.isFinite(move[1]) &&
  typeof move[2] === "string";

export type LensJudged = Judged & { km: number; rightCountry: boolean };

export function judge(puzzle: Puzzle, round: number, move: Move): LensJudged {
  const landmark = puzzle.rounds[round]?.landmark;
  if (!landmark || !isPinCountryMove(move))
    return { hit: false, share: 0, km: Infinity, rightCountry: false };
  const km = distanceKm({ lat: move[0], lon: move[1] }, landmark);
  const rightCountry = move[2] === landmark.country || km <= SAME_COUNTRY_KM;
  const share =
    DISTANCE_SHARE * nearness(km) + (rightCountry ? COUNTRY_SHARE : 0);
  return { hit: false, share: Math.round(share * 1e6) / 1e6, km, rightCountry };
}

export const walkOf = (puzzle: Puzzle, moves: readonly Move[]) =>
  walkRounds(puzzle.rounds.length, moves, 1, (round, move) =>
    judge(puzzle, round, move),
  );

/** Right countries and the average distance of the pins dropped (null when none were). */
export function tallyOf(
  puzzle: Puzzle,
  moves: readonly Move[],
): { rightCountries: number; averageKm: number | null } {
  const judged = walkOf(puzzle, moves)
    .rounds.map((round, i) => {
      const last = round.done ? round.tries.at(-1) : undefined;
      return last ? judge(puzzle, i, last.move) : null;
    })
    .filter((entry): entry is LensJudged => entry !== null);
  return {
    rightCountries: judged.filter((entry) => entry.rightCountry).length,
    averageKm: judged.length
      ? judged.reduce((sum, entry) => sum + entry.km, 0) / judged.length
      : null,
  };
}

// ── Dealing ─────────────────────────────────────────────────────────────────

/** Two landmarks of one puzzle are never this close (two photos of one city). */
const APART_KM = 300;

/**
 * Five landmarks from five countries, from both pools (at most three from
 * either) and spread over the continents: one each where the shuffle allows,
 * never more than two. Each shows one of its photos, its main photo half the time.
 */
function dealRounds(seed: string): Puzzle {
  const order = seededShuffle(POOL, seed);
  const random = seededRandom(`${seed}:photos`);
  const picked: { landmark: Landmark; pool: Pool }[] = [];
  const fill = (perRegion: number, perPool: number) => {
    for (const entry of order) {
      if (picked.length >= ROUNDS) return;
      const { landmark, pool } = entry;
      const region = regionOf(landmark.country);
      if (
        picked.includes(entry) ||
        picked.some((other) => other.landmark.country === landmark.country) ||
        picked.filter((other) => regionOf(other.landmark.country) === region)
          .length >= perRegion ||
        picked.filter((other) => other.pool === pool).length >= perPool ||
        picked.some((other) => distanceKm(other.landmark, landmark) < APART_KM)
      )
        continue;
      picked.push(entry);
    }
  };
  fill(1, 3);
  fill(2, 3);
  fill(2, ROUNDS);
  return {
    rounds: picked.map(({ landmark }) => {
      const roll = random();
      const others = landmark.photos.length - 1;
      return {
        landmark,
        photo:
          roll < 0.5 || others === 0
            ? 0
            : 1 + Math.floor(((roll - 0.5) / 0.5) * others),
      };
    }),
  };
}

const idOf = (round: Round) => `${round.landmark.id}~${round.photo}`;

function fromIds(ids: string[]): Puzzle | undefined {
  if (!ids.length) return undefined;
  const rounds: Round[] = [];
  for (const id of ids) {
    const [key, photoText = "0"] = id.split("~");
    const landmark = landmarkById(key);
    const photo = Number(photoText);
    if (
      !landmark ||
      !Number.isInteger(photo) ||
      photo < 0 ||
      photo >= landmark.photos.length
    )
      return undefined;
    rounds.push({ landmark, photo });
  }
  return { rounds };
}

export default defineSetData<Puzzle, Move>(definition.slug, {
  forDay: (day) => dealRounds(`${definition.slug}:day:${day}`),
  deal: (seed) => dealRounds(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (puzzle) => puzzle.rounds.map(idOf),
  score(puzzle, moves) {
    const walk = walkOf(puzzle, moves);
    return roundsScore(walk.shares, puzzle.rounds.length, walk.over);
  },
  answer: (puzzle, locale) => puzzle.rounds[0]?.landmark.name[locale] ?? "",
});
