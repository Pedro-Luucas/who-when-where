import type { ImageCreditData } from "@/components/image-credit";
import { seededShuffle } from "@/lib/daily";
import type { Localized } from "@/lib/i18n";
import { defineSetData } from "../engines/kit";
import { PASS, closeness, roundsScore } from "../engines/rules";
import { definition } from "./definition";
import PHOTOS_JSON from "./data/photos.json";

// Year Snap without its interface: five historical photos, and for each one
// the year the player set on the dial. A photo is worth up to a fifth of the
// points, less the further the year is from the real one. The photos come
// from Wikimedia Commons (scripts/fetch-photos.mjs builds data/photos.json).

export const ROUNDS = 5;
/** The dial's first year. */
export const MIN_YEAR = 1830;
/** Where the dial starts: about the middle of the photos' years. */
export const START_YEAR = 1925;

export type Photo = {
  id: string;
  year: number;
  /** What it shows. Shown only once the year is locked in. */
  caption: Localized;
  place?: { lat: number; lon: number };
  image: { src: string; width: number; height: number; credit: ImageCreditData };
};

export type Puzzle = Photo[];
/** The year set on the dial, or PASS for a photo given up. */
export type Move = number | typeof PASS;

export const PHOTOS: readonly Photo[] = PHOTOS_JSON as Photo[];
const BY_ID = new Map(PHOTOS.map((photo) => [photo.id, photo]));

const decadeOf = (year: number) => Math.floor(year / 10);

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Years off → share of a photo's points: exp(−off / 10.5). The exact year
 * earns all of it, 1 off 0.91, 3 off 0.75, 10 off 0.39, 25 off 0.09.
 */
const SCALE_YEARS = 10.5;
/** Within this many years a photo counts as a hit (a green square). */
export const HIT_YEARS = 2;
/** Within this many, as close. */
export const NEAR_YEARS = 10;

export type Verdict = "hit" | "near" | "miss" | "skip";

export type Judged = { year: number | null; off: number | null; share: number; verdict: Verdict };

export const isYearMove = (move: unknown): move is number => typeof move === "number" && Number.isFinite(move);

export function judge(photo: Photo, move: Move): Judged {
  if (!isYearMove(move)) return { year: null, off: null, share: 0, verdict: "skip" };
  const year = Math.round(move);
  const off = Math.abs(year - photo.year);
  return {
    year,
    off,
    share: closeness(off, 0, SCALE_YEARS),
    verdict: off <= HIT_YEARS ? "hit" : off <= NEAR_YEARS ? "near" : "miss",
  };
}

/** How the photos stand after `moves`: one move per photo, moves past the last ignored. */
export function walkOf(puzzle: Puzzle, moves: readonly Move[]) {
  const rounds = moves.slice(0, puzzle.length).map((move, i) => judge(puzzle[i], move));
  const over = rounds.length >= puzzle.length;
  return { rounds, done: rounds.length, over, shares: rounds.map((round) => round.share) };
}

export function scoreOf(puzzle: Puzzle, moves: readonly Move[]) {
  const walk = walkOf(puzzle, moves);
  return roundsScore(walk.shares, puzzle.length, walk.over);
}

// ── Dealing ─────────────────────────────────────────────────────────────────

/** Two photos of one puzzle are never from the same decade, nor this close in years. */
const MIN_YEARS_APART = 5;

/**
 * Five photos from five decades, in a seeded order, avoiding `used` (photos
 * dealt on the days before) as long as that still leaves five.
 */
function dealPhotos(seed: string, used: ReadonlySet<string> = new Set()): Puzzle {
  const order = seededShuffle(PHOTOS, seed);
  const fresh = order.filter((photo) => !used.has(photo.id));
  for (const pool of [fresh, order]) {
    const chosen: Photo[] = [];
    for (const photo of pool) {
      if (
        chosen.every(
          (other) => decadeOf(other.year) !== decadeOf(photo.year) && Math.abs(other.year - photo.year) >= MIN_YEARS_APART,
        )
      )
        chosen.push(photo);
      if (chosen.length === ROUNDS) return chosen;
    }
  }
  return order.slice(0, ROUNDS);
}

/**
 * The daily photos come in cycles of a fortnight: no photo comes back within
 * a cycle. Each day is still dealt from its own seed; the days of its cycle
 * before it only say which photos are taken.
 */
const CYCLE_DAYS = 14;
const dayCache = new Map<number, Puzzle>();

function forDay(day: number): Puzzle {
  const cached = dayCache.get(day);
  if (cached) return cached;
  const start = day - ((((day - 1) % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS);
  const used = new Set<string>();
  let puzzle: Puzzle = [];
  for (let d = start; d <= day; d++) {
    puzzle = dayCache.get(d) ?? dealPhotos(`${definition.slug}:day:${d}`, used);
    dayCache.set(d, puzzle);
    for (const photo of puzzle) used.add(photo.id);
  }
  return puzzle;
}

function fromIds(ids: string[]): Puzzle | undefined {
  const photos = ids.map((id) => BY_ID.get(id));
  if (photos.length !== ROUNDS || photos.some((photo) => photo === undefined)) return undefined;
  return photos as Photo[];
}

export default defineSetData<Puzzle, Move>(definition.slug, {
  forDay,
  deal: (seed) => dealPhotos(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (photos) => photos.map((photo) => photo.id),
  score: (photos, moves) => scoreOf(photos, moves),
  answer: (photos) => photos.map((photo) => photo.year).join(" · "),
});
