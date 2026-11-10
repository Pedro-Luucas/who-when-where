import { distanceKm, type LatLon } from "@/lib/geo";
import { triesPoints, type Score } from "@/lib/points";
import type { Site } from "./sites";

/** Digs per puzzle. */
export const MAX_DIGS = 5;

/** A dig this close has found the site. */
export const FOUND_KM = 50;

export type Dig = { lat: number; lon: number; km: number };

// How warm a dig is, from 0 (found) to 5 (freezing). Each step is a ring
// roughly two to three times wider than the last.
const HEAT_LIMITS_KM = [FOUND_KM, 250, 700, 1800, 4500];

export type Heat = 0 | 1 | 2 | 3 | 4 | 5;

export function heatOf(km: number): Heat {
  const index = HEAT_LIMITS_KM.findIndex((limit) => km <= limit);
  return (index === -1 ? HEAT_LIMITS_KM.length : index) as Heat;
}

export function gradeDig(site: Site, pin: LatLon): Dig {
  return {
    lat: +pin.lat.toFixed(4),
    lon: +pin.lon.toFixed(4),
    km: Math.round(distanceKm(pin, site)),
  };
}

export const isFound = (digs: Dig[]): boolean => digs.some((dig) => dig.km <= FOUND_KM);

export const isOver = (digs: Dig[], max = MAX_DIGS): boolean => isFound(digs) || digs.length >= max;

export const closestKm = (digs: Dig[]): number => Math.min(...digs.map((dig) => dig.km));

// A site left buried still earns a little for getting close.
const NEAR_MISS_POINTS = 150;
const NEAR_MISS_FALLOFF_KM = 1500;

/** How a puzzle stands, on the scale every game shares. */
export function scoreOf(digs: Dig[], max = MAX_DIGS): Score {
  const found = isFound(digs);
  const consolation = digs.length
    ? Math.round(NEAR_MISS_POINTS * Math.exp(-closestKm(digs) / NEAR_MISS_FALLOFF_KM))
    : 0;
  return {
    over: isOver(digs, max),
    points: found ? triesPoints(digs.length, max) : consolation,
    detail: `${found ? digs.length : "X"}/${max}`,
  };
}
