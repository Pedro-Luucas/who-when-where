import { distanceKm, type LatLon } from "@/lib/geo";
import type { Score } from "@/lib/points";
import type { Person } from "./people";

// The rounds of one puzzle, in play order. To add a round, add it here and
// give it a question in messages.ts — scoring and storage follow `kind`.
export const ROUNDS = [
  { id: "birthPlace", kind: "place", event: "birth" },
  { id: "birthYear", kind: "year", event: "birth" },
  { id: "deathPlace", kind: "place", event: "death" },
  { id: "deathYear", kind: "year", event: "death" },
] as const;

export type Round = (typeof ROUNDS)[number];

export const ROUND_MAX = 250;
export const TOTAL_MAX = ROUND_MAX * ROUNDS.length;

export type PlaceGuess = { kind: "place"; lat: number; lon: number; km: number; score: number };
export type YearGuess = { kind: "year"; year: number; diff: number; score: number };
export type Guess = PlaceGuess | YearGuess;

// Full marks within 20 km (a pin can't be placed much finer than a city),
// then an exponential fall-off: ~230 at 100 km, ~160 at 500 km, ~40 at 2,000 km.
const BULLSEYE_KM = 20;
const DISTANCE_FALLOFF_KM = 1100;

export function scorePlace(km: number): number {
  if (km <= BULLSEYE_KM) return ROUND_MAX;
  return Math.round(ROUND_MAX * Math.exp(-(km - BULLSEYE_KM) / DISTANCE_FALLOFF_KM));
}

// ~210 when 5 years off, ~175 at 10, ~120 at 20, ~40 at 50.
const YEAR_FALLOFF = 28;

export function scoreYear(diff: number): number {
  return Math.round(ROUND_MAX * Math.exp(-diff / YEAR_FALLOFF));
}

export function gradePlace(person: Person, round: Round, pin: LatLon): PlaceGuess {
  const km = distanceKm(pin, person[round.event].place);
  return {
    kind: "place",
    lat: +pin.lat.toFixed(4),
    lon: +pin.lon.toFixed(4),
    km: Math.round(km),
    score: scorePlace(km),
  };
}

export function gradeYear(person: Person, round: Round, year: number): YearGuess {
  const diff = Math.abs(year - person[round.event].year);
  return { kind: "year", year, diff, score: scoreYear(diff) };
}

export const totalScore = (guesses: Guess[]) =>
  guesses.reduce((sum, guess) => sum + guess.score, 0);

/** How a puzzle stands, on the scale every game shares (it is this game's own). */
export function scoreOf(guesses: Guess[]): Score {
  const total = totalScore(guesses);
  return { over: guesses.length >= ROUNDS.length, points: total, detail: String(total) };
}

/** 0–4, used for rank titles. */
export function rankOf(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total >= 900) return 4;
  if (total >= 750) return 3;
  if (total >= 550) return 2;
  if (total >= 300) return 1;
  return 0;
}
