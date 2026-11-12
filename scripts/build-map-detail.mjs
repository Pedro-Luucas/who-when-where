// Builds public/geo/detail/ — the high-detail world the map switches to when
// the player zooms in close (to a region, a city). The everyday map
// (public/geo/countries-50m.json) stays the only thing a page loads up front;
// these tiles are fetched one by one, only for the part of the world in view
// and only past a zoom threshold (components/world-map.tsx).
//
// Source: world-atlas 2 countries-10m.json — Natural Earth 1:10m admin 0
// countries (public domain), as TopoJSON. Same shape names as the 50m map, so
// regions coloured by name keep working. Pass a local copy, or let the script
// download it:
//
//   npm run data:detail [-- <path-to-countries-10m.json>]
//
// Output: one file per 10° × 10° tile that has land, <x>-<y>.json, with x the
// tile's column from 180°W and y its row from 90°S, and index.json, the list
// of tiles that exist. A tile holds every country's land inside it, clipped to
// the tile: { c: [[name, polygons]] }, a polygon being its rings, a ring a flat
// list of delta-coded integers ([x0, y0, dx1, dy1, …]) in 1/8192ths of the
// tile from its south-west corner. Rings are not closed (the reader closes
// them) and keep d3's winding (outer rings clockwise, holes anticlockwise).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { geoArea, geoEquirectangular, geoStream } from "d3-geo";
import { feature } from "topojson-client";

const SOURCE_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json";
const TARGET = "public/geo/detail";
const TILE = 10;
const UNITS = 8192;

const topology = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], "utf8"))
  : await fetch(SOURCE_URL).then((response) => {
      if (!response.ok) throw new Error(`${SOURCE_URL}: HTTP ${response.status}`);
      return response.json();
    });
// A few of the source's polygons (the Maldives) are wound inside out, which
// d3 reads as "the whole world but this"; turn them round before clipping.
const countries = feature(topology, topology.objects.countries).features.map((country) => {
  const { geometry } = country;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const fixed = polygons.map((rings) =>
    geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI ? rings.map((ring) => ring.toReversed()) : rings,
  );
  return { ...country, geometry: { type: "MultiPolygon", coordinates: fixed } };
});

/** The geometry's polygons clipped to a box (degrees), each as a list of rings. */
function clip(geometry, west, south, east, north) {
  const polygons = [];
  let rings = null;
  let ring = null;
  const sink = {
    point(x, y) {
      ring?.push([x, -y]);
    },
    lineStart() {
      ring = [];
    },
    lineEnd() {
      if (ring?.length) rings?.push(ring);
      ring = null;
    },
    polygonStart() {
      rings = [];
    },
    polygonEnd() {
      if (rings?.length) polygons.push(rings);
      rings = null;
    },
    sphere() {},
  };
  // A plate carrée in degrees (x = longitude, y = -latitude): d3 first cuts
  // the shapes at the antimeridian (Russia's and Fiji's rings run from 180°
  // to -180°), then clips them to the tile on the plane.
  const box = geoEquirectangular()
    .scale(180 / Math.PI)
    .translate([0, 0])
    .precision(0)
    .clipExtent([
      [west, -north],
      [east, -south],
    ]);
  geoStream(geometry, box.stream(sink));
  return polygons;
}

/** Twice the signed area of a ring in the plane (positive: anticlockwise, y up). */
function planarArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum;
}

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** A ring on the tile's integer grid, without repeated points; null when nothing is left of it. */
function snap(ring, west, south) {
  const out = [];
  for (const [lon, lat] of ring) {
    const x = Math.min(Math.max(Math.round(((lon - west) / TILE) * UNITS), 0), UNITS);
    const y = Math.min(Math.max(Math.round(((lat - south) / TILE) * UNITS), 0), UNITS);
    const last = out.at(-1);
    if (!last || last[0] !== x || last[1] !== y) out.push([x, y]);
  }
  while (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
  return out.length >= 3 && planarArea(out) !== 0 ? out : null;
}

const toDegrees = (ring, west, south) => ring.map(([x, y]) => [west + (x / UNITS) * TILE, south + (y / UNITS) * TILE]);

/** As a polygon of its own, does the ring cover less than half the sphere (d3's winding for an outer ring)? */
function small(ring, west, south) {
  const coordinates = toDegrees(ring, west, south);
  return geoArea({ type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] }) < 2 * Math.PI;
}

/** A point of the ring off the tile's edges, to test whether another ring holds it. */
const probe = (ring) => ring.find(([x, y]) => x > 0 && x < UNITS && y > 0 && y < UNITS);

/**
 * Sorts a clipped polygon's rings into polygons: a ring inside an odd number
 * of the others is a hole. Each ring is wound the way d3 reads it (outer rings
 * small, holes the other way round), whatever the clipping left.
 */
function polygonsOf(rings, west, south) {
  const depth = rings.map((ring) => {
    const point = probe(ring);
    return point ? rings.filter((other) => other !== ring && inside(point, other)).length : 0;
  });
  const outers = rings.filter((_, i) => depth[i] % 2 === 0).map((ring) => [small(ring, west, south) ? ring : ring.toReversed()]);
  rings.forEach((hole, i) => {
    if (depth[i] % 2 === 0) return;
    const home = outers.find(([outer]) => inside(probe(hole), outer));
    if (home) home.push(small(hole, west, south) ? hole.toReversed() : hole);
  });
  return outers;
}

function encode(ring) {
  const out = [ring[0][0], ring[0][1]];
  for (let i = 1; i < ring.length; i++) out.push(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
  return out;
}

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(TARGET, { recursive: true });

const index = [];
let total = 0;
let largest = { key: "", bytes: 0 };
for (let x = 0; x < 360 / TILE; x++) {
  for (let y = 0; y < 180 / TILE; y++) {
    const west = -180 + x * TILE;
    const south = -90 + y * TILE;
    const tile = [];
    for (const country of countries) {
      const out = [];
      for (const rings of clip(country.geometry, west, south, west + TILE, south + TILE)) {
        const snapped = rings.map((ring) => snap(ring, west, south)).filter(Boolean);
        out.push(...polygonsOf(snapped, west, south).map((polygon) => polygon.map(encode)));
      }
      if (out.length) tile.push([country.properties.name, out]);
    }
    if (!tile.length) continue;
    const key = `${x}-${y}`;
    const json = JSON.stringify({ c: tile });
    writeFileSync(`${TARGET}/${key}.json`, json);
    index.push(key);
    total += json.length;
    if (json.length > largest.bytes) largest = { key, bytes: json.length };
  }
}
writeFileSync(`${TARGET}/index.json`, JSON.stringify({ tile: TILE, units: UNITS, tiles: index }));

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
console.log(`${index.length} tiles, ${kb(total)} in all, the largest ${largest.key} (${kb(largest.bytes)}) → ${TARGET}`);
