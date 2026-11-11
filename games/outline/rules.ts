import { COUNTRIES, countryById, type Country } from "@/lib/countries";
import { dailyIndex } from "@/lib/daily";
import { distanceKm, type LatLon } from "@/lib/geo";
import { triesPoints, type Score } from "@/lib/points";

export const MAX_GUESSES = 6;

/**
 * A guess given up rather than made: it fills a try and names no country, so
 * it can't join the two ends or bring a reading closer. Saved like any other
 * guess, so every older reader still understands the record.
 */
export const PASS = "-";


// Smaller countries are a few pixels of coastline on the map this is drawn
// from: fine to guess, no good as the mystery.
const MIN_AREA_KM2 = 2500;

/** The countries that can be the mystery. Any country can be guessed. */
export const TARGETS = COUNTRIES.filter((country) => country.area >= MIN_AREA_KM2);

export function countryForDay(day: number): Country {
  return TARGETS[dailyIndex(TARGETS.length, day, "outline")];
}

export const isTarget = (id: string): boolean => TARGETS.some((country) => country.id === id);

// Extra clues unlock once this many guesses have been used.
export const HEMISPHERE_CLUE_AT = 2;
export const SIZE_CLUE_AT = 3;
export const BORDERS_CLUE_AT = 4;

// How warm a guess is, from 0 (the country itself) to 5 (the other side of
// the world), by the distance between the two countries' centres.
const HEAT_LIMITS_KM = [0, 900, 2200, 4500, 8000];

export type Heat = 0 | 1 | 2 | 3 | 4 | 5;

export function heatOf(km: number): Heat {
  const index = HEAT_LIMITS_KM.findIndex((limit) => km <= limit);
  return (index === -1 ? HEAT_LIMITS_KM.length : index) as Heat;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Compass direction from one point towards another, in eighths of a turn: 0 north, 2 east, 4 south… */
export function directionOf(from: LatLon, to: LatLon): number {
  const dLon = toRad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return ((Math.round(bearing / 45) % 8) + 8) % 8;
}

/** What a guess tells the player: how far the mystery country is, and which way. */
export type Reading = { country: Country; km: number; heat: Heat; direction: number; hit: boolean };

/** Half the way round the world: as far as two places can be. */
const FARTHEST_KM = 20_000;

export function readingOf(target: Country, id: string): Reading | null {
  const country = countryById(id);
  if (!country) return null;
  const hit = country.id === target.id;
  const km = hit ? 0 : Math.round(distanceKm(country, target));
  return { country, km, heat: hit ? 0 : heatOf(km) || 1, direction: directionOf(country, target), hit };
}

/** 100 for the country itself, 0 for the far side of the world. */
export const closenessOf = (km: number): number => Math.max(0, Math.round((1 - km / FARTHEST_KM) * 100));

export const isSolved = (targetId: string, guesses: string[]): boolean => guesses[guesses.length - 1] === targetId;

export const isOver = (targetId: string, guesses: string[], max = MAX_GUESSES): boolean =>
  isSolved(targetId, guesses) || guesses.length >= max;

// A country never named still earns a little for getting close.
const NEAR_MISS_POINTS = 150;
const NEAR_MISS_FALLOFF_KM = 2500;

/** How a puzzle stands, on the scale every game shares. */
export function scoreOf(targetId: string, guesses: string[], max = MAX_GUESSES): Score {
  const solved = isSolved(targetId, guesses);
  const target = countryById(targetId);
  const distances = target
    ? guesses.map((id) => readingOf(target, id)?.km).filter((km): km is number => km !== undefined)
    : [];
  const consolation = distances.length
    ? Math.round(NEAR_MISS_POINTS * Math.exp(-Math.min(...distances) / NEAR_MISS_FALLOFF_KM))
    : 0;
  return {
    over: isOver(targetId, guesses, max),
    points: solved ? triesPoints(guesses.length, max) : consolation,
    detail: `${solved ? guesses.length : "X"}/${max}`,
  };
}
