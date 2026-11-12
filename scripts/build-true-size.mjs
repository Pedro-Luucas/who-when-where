// Builds games/true-size/data/sizes.json: for each country big enough for
// True Size, the area of the land the game draws (its mainland and what lies
// near it) and how big the familiar web map (Mercator) makes that land look.
//
//   node scripts/build-true-size.mjs
//
// Both come from the world map the site draws (public/geo/countries-50m.json,
// Natural Earth, public domain), so what the board shows and what it scores
// are the same land: the board leaves out exactly the pieces listed under
// `drop` (games/true-size/shapes.ts, landOf), counted in the same order.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { geoArea, geoCentroid, geoDistance, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const OUT = path.join(ROOT, "games/true-size/data/sizes.json");

/** The Earth's radius in km, so that steradians become km². */
const R = 6371.0088;
const KM2 = R * R;
/** Countries smaller than this are left out: too small to compare by eye. */
const MIN_AREA = 25000;
/** Left out on purpose: no country, a disputed one, or a shape the web map tears apart. */
const SKIP = new Set(["aq", "eh", "fj", "ki"]);

/** A piece this big next to the mainland is always drawn (Alaska, the South Island). */
const BIG_SHARE = 0.2;
/** Otherwise a piece is drawn when it lies this close to land already drawn: islands off the coast, archipelagos. */
const REACH_KM = 450;
/** The web map stops at 80° north and south here. */
const MAX_LAT = 80;

/** Every polygon of the country's shapes, in the order the board reads them (games/true-size/shapes.ts). */
const piecesOf = (shapes) =>
  shapes.flatMap((shape) =>
    shape.geometry.type === "Polygon"
      ? [shape.geometry.coordinates]
      : shape.geometry.type === "MultiPolygon"
        ? shape.geometry.coordinates
        : [],
  );

/**
 * Which pieces the game leaves out: far-flung islands and overseas lands that
 * would shrink the mainland to a dot. Kept: the mainland, any piece a fifth
 * its size, and, one after another, the pieces near land already kept.
 */
function dropped(coordinates) {
  const pieces = coordinates.map((rings) => {
    const polygon = { type: "Polygon", coordinates: rings };
    const outer = rings[0];
    const step = Math.max(1, Math.floor(outer.length / 200));
    return { area: geoArea(polygon), centre: geoCentroid(polygon), edge: outer.filter((_, i) => i % step === 0) };
  });
  const main = pieces.reduce((best, piece, i) => (piece.area > pieces[best].area ? i : best), 0);
  const reach = Math.max(REACH_KM / R, Math.sqrt(pieces[main].area / Math.PI));
  const kept = new Set(pieces.map((piece, i) => i).filter((i) => i === main || pieces[i].area >= BIG_SHARE * pieces[main].area));
  let grew = true;
  while (grew) {
    grew = false;
    pieces.forEach((piece, i) => {
      if (kept.has(i)) return;
      const near = [...kept].some((k) => pieces[k].edge.some((point) => geoDistance(piece.centre, point) <= reach));
      if (near) {
        kept.add(i);
        grew = true;
      }
    });
  }
  return pieces.map((_, i) => i).filter((i) => !kept.has(i));
}

/** Mercator at scale 1, centred on `lon`, cut at MAX_LAT. */
function mercator(lon) {
  const y = Math.log(Math.tan(Math.PI / 4 + (MAX_LAT * Math.PI) / 360));
  return geoMercator()
    .rotate([-lon, 0])
    .scale(1)
    .translate([0, 0])
    .clipExtent([
      [-10, -y],
      [10, y],
    ]);
}

async function main() {
  const topology = JSON.parse(await readFile(path.join(ROOT, "public/geo/countries-50m.json"), "utf8"));
  const world = feature(topology, topology.objects.countries);
  const countries = JSON.parse(await readFile(path.join(ROOT, "lib/data/countries.json"), "utf8"));
  const regions = JSON.parse(await readFile(path.join(ROOT, "lib/data/regions.json"), "utf8"));
  const sizes = {};
  for (const country of countries) {
    if (country.area < MIN_AREA || SKIP.has(country.id) || !regions[country.id]) continue;
    const shapes = world.features.filter((shape) => country.shapes.includes(shape.properties?.name));
    if (!shapes.length) continue;
    const pieces = piecesOf(shapes);
    const drop = dropped(pieces);
    const land = { type: "MultiPolygon", coordinates: pieces.filter((_, i) => !drop.includes(i)) };
    const [lon, lat] = geoCentroid(land);
    const area = geoArea(land) * KM2;
    const merc = geoPath(mercator(lon)).area(land) * KM2;
    sizes[country.id] = {
      area: Math.round(area),
      merc: Math.round(merc),
      lat: +lat.toFixed(2),
      lon: +lon.toFixed(2),
      region: regions[country.id],
      ...(drop.length && { drop }),
    };
  }
  await writeFile(OUT, JSON.stringify(sizes) + "\n");
  console.log(`${Object.keys(sizes).length} countries → ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
