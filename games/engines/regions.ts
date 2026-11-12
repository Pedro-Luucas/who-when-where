import type { Variant } from "../platform/definition";
import { REGIONS, regionOf, type Region } from "@/lib/geo-data";
import type { LatLon } from "@/lib/geo";

// The region sets the map games offer in practice (Pin the City, Click the
// Country, Type the Countries): the world, each continent, the Americas
// together. The first is the default, and the daily puzzle's.

export const REGION_SETS = ["world", "europe", "asia", "africa", "americas", "oceania"] as const;
export type RegionSet = (typeof REGION_SETS)[number];

export const REGION_VARIANTS: Variant[] = [
  { id: "world", name: { en: "World", pt: "Mundo" } },
  { id: "europe", name: { en: "Europe", pt: "Europa" } },
  { id: "asia", name: { en: "Asia", pt: "Ásia" } },
  { id: "africa", name: { en: "Africa", pt: "África" } },
  { id: "americas", name: { en: "Americas", pt: "Américas" } },
  { id: "oceania", name: { en: "Oceania", pt: "Oceania" } },
];

export const isRegionSet = (value: string | undefined): value is RegionSet =>
  value !== undefined && (REGION_SETS as readonly string[]).includes(value);

/** The continents a set is made of. */
export const regionsOf = (set: RegionSet): readonly Region[] =>
  set === "world" ? REGIONS : set === "americas" ? ["north-america", "south-america"] : [set];

/** Whether a country (by its ISO code) is in a set. */
export function inSet(countryId: string, set: RegionSet): boolean {
  const region = regionOf(countryId);
  return region !== undefined && regionsOf(set).includes(region);
}

/** Two corners that frame a set on the map; undefined for the whole world. */
export const VIEWS: Record<RegionSet, LatLon[] | undefined> = {
  world: undefined,
  europe: [
    { lat: 35, lon: -12 },
    { lat: 66, lon: 40 },
  ],
  asia: [
    { lat: -8, lon: 30 },
    { lat: 55, lon: 145 },
  ],
  africa: [
    { lat: -35, lon: -18 },
    { lat: 37, lon: 52 },
  ],
  americas: [
    { lat: -55, lon: -125 },
    { lat: 60, lon: -35 },
  ],
  oceania: [
    { lat: -47, lon: 110 },
    { lat: 0, lon: 180 },
  ],
};
