"use client";

import { geoContains } from "d3-geo";
import { loadWorld } from "@/components/world-map";
import { COUNTRIES } from "@/lib/countries";
import { distanceKm, type LatLon } from "@/lib/geo";

// Which country is under a point of the map: for the Pin engine's country
// rounds (tap the country). The world map's own shapes decide, so what the
// player sees is what they hit. A tap that lands in the sea next to a small
// country (an island, a city-state) counts as that country.

const byShape = new Map(COUNTRIES.flatMap((country) => country.shapes.map((shape) => [shape, country.id] as const)));

/** A tap within this many kilometres of a small country's centre counts as that country. */
const NEAR_SMALL_KM = 90;
const SMALL_AREA_KM2 = 30_000;
const SMALL = COUNTRIES.filter((country) => country.area < SMALL_AREA_KM2);

/** The id of the country under `point`, or null for the sea (and the shapes that are not played, like Antarctica). */
export async function countryAt(point: LatLon): Promise<string | null> {
  const world = await loadWorld();
  const position: [number, number] = [point.lon, point.lat];
  for (const shape of world.features) {
    if (geoContains(shape, position)) {
      const id = byShape.get(shape.properties?.name);
      if (id) return id;
    }
  }
  let nearest: { id: string; km: number } | null = null;
  for (const country of SMALL) {
    const km = distanceKm(point, country);
    if (km <= NEAR_SMALL_KM && (!nearest || km < nearest.km)) nearest = { id: country.id, km };
  }
  return nearest?.id ?? null;
}
