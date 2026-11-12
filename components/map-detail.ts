import type { GeoProjection } from "d3-geo";
import type { MultiLineString, MultiPolygon, Position } from "geojson";

// The world in high detail (Natural Earth 1:10m), for a map zoomed in close.
// Cut into 10° tiles (scripts/build-map-detail.mjs) and fetched only past the
// zoom where the everyday 1:50m map starts to look crude, and only for the
// part of the world in view, so a page that is never zoomed in pays nothing.

/** Past this ground resolution (km per screen pixel) the map draws the detailed world. */
export const DETAIL_KM_PER_PX = 1.6;

const BASE = "/geo/detail";

type Index = { tile: number; units: number; tiles: Set<string> };

/** One country's land inside a tile: its shape to fill, and its coast and borders to stroke (the tile's own edges left out). */
export type DetailShape = { name: string; fill: MultiPolygon; edges: MultiLineString };

let indexRequest: Promise<Index> | null = null;
let indexNow: Index | null = null;
const tiles = new Map<string, DetailShape[]>();
const requests = new Map<string, Promise<void>>();

function loadIndex(): Promise<Index> {
  indexRequest ??= fetch(`${BASE}/index.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`Map detail: HTTP ${response.status}`);
      return response.json();
    })
    .then((raw: { tile: number; units: number; tiles: string[] }) => ({ ...raw, tiles: new Set(raw.tiles) }))
    .catch((error) => {
      indexRequest = null;
      throw error;
    });
  return indexRequest;
}

function decode(key: string, raw: { c: [string, number[][][]][] }, index: Index): DetailShape[] {
  const [x, y] = key.split("-").map(Number);
  const { tile: size, units } = index;
  const west = -180 + x * size;
  const south = -90 + y * size;
  const degrees = (gx: number, gy: number): Position => [west + (gx / units) * size, south + (gy / units) * size];
  // A step along the tile's own edge is where the clipping cut the land, not a coast.
  const onEdge = (ax: number, ay: number, bx: number, by: number) =>
    (ax === bx && (ax === 0 || ax === units)) || (ay === by && (ay === 0 || ay === units));

  return raw.c.map(([name, polygons]) => {
    const edges: Position[][] = [];
    const fill = polygons.map((rings) =>
      rings.map((flat) => {
        const grid: [number, number][] = [];
        for (let i = 0, gx = 0, gy = 0; i < flat.length; i += 2) {
          gx += flat[i];
          gy += flat[i + 1];
          grid.push([gx, gy]);
        }
        grid.push(grid[0]);
        let line: Position[] = [];
        for (let i = 1; i < grid.length; i++) {
          const [ax, ay] = grid[i - 1];
          const [bx, by] = grid[i];
          if (onEdge(ax, ay, bx, by)) {
            if (line.length > 1) edges.push(line);
            line = [];
          } else {
            if (!line.length) line.push(degrees(ax, ay));
            line.push(degrees(bx, by));
          }
        }
        if (line.length > 1) edges.push(line);
        return grid.map(([gx, gy]) => degrees(gx, gy));
      }),
    );
    return {
      name,
      fill: { type: "MultiPolygon", coordinates: fill },
      edges: { type: "MultiLineString", coordinates: edges },
    };
  });
}

/**
 * The tiles covering a box of longitude and latitude; `east` goes past 180
 * for a box across the antimeridian. Null until the list of tiles is known.
 */
export function detailTilesIn(west: number, south: number, east: number, north: number): string[] | null {
  const index = indexNow;
  if (!index) return null;
  const { tile: size, tiles: existing } = index;
  const columns = 360 / size;
  const first = Math.floor((west + 180) / size);
  const last = Math.floor((east + 180) / size);
  const keys: string[] = [];
  const bottom = Math.max(Math.floor((south + 90) / size), 0);
  const top = Math.min(Math.floor((north + 90) / size), 180 / size - 1);
  for (let column = first; column <= Math.min(last, first + columns - 1); column++) {
    const x = ((column % columns) + columns) % columns;
    for (let y = bottom; y <= top; y++) {
      const key = `${x}-${y}`;
      if (existing.has(key)) keys.push(key);
    }
  }
  return keys;
}

/** Fetches the list of tiles (once); resolves when `detailTilesIn` can answer. */
export function prepareDetail(): Promise<void> {
  return loadIndex().then((index) => {
    indexNow = index;
  });
}

/** A tile's shapes, if it has been fetched. */
export const detailTile = (key: string): DetailShape[] | undefined => tiles.get(key);

/** The detailed shapes around a place, if its tile has been fetched (the player has zoomed in there). */
export function detailShapesAt(lon: number, lat: number): DetailShape[] | undefined {
  if (!indexNow) return undefined;
  const { tile: size } = indexNow;
  const x = Math.min(Math.floor((lon + 180) / size), 360 / size - 1);
  const y = Math.min(Math.floor((lat + 90) / size), 180 / size - 1);
  const key = `${x}-${y}`;
  // A tile with no land in it is not in the index: there, it is all sea.
  return indexNow.tiles.has(key) ? tiles.get(key) : [];
}

/** Fetches tiles not fetched yet; resolves once all of them are in. Shared by every map on the page. */
export function loadDetailTiles(keys: string[]): Promise<void> {
  return loadIndex().then((index) =>
    Promise.all(
      keys
        .filter((key) => !tiles.has(key))
        .map((key) => {
          let request = requests.get(key);
          if (!request) {
            request = fetch(`${BASE}/${key}.json`)
              .then((response) => {
                if (!response.ok) throw new Error(`Map detail ${key}: HTTP ${response.status}`);
                return response.json();
              })
              .then((raw) => {
                tiles.set(key, decode(key, raw, index));
              })
              .finally(() => requests.delete(key));
            requests.set(key, request);
          }
          return request;
        }),
    ).then(() => undefined),
  );
}

/**
 * The longitude and latitude a box of the screen covers: the frame's corners
 * and edges taken back through the projection, as [west, south, east,
 * north]. West is in -180…180; east is past 180 for a box across the
 * antimeridian. Null when the box is off the globe.
 */
export function boundsOnScreen(
  invert: (point: [number, number]) => [number, number] | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number, number] | null {
  const centre = invert([(x0 + x1) / 2, (y0 + y1) / 2]);
  const lons: number[] = [];
  const lats: number[] = [];
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      const at = invert([x0 + ((x1 - x0) * i) / 4, y0 + ((y1 - y0) * j) / 4]);
      if (!at) continue;
      const lon = centre ? centre[0] + ((((at[0] - centre[0]) % 360) + 540) % 360) - 180 : at[0];
      lons.push(lon);
      lats.push(at[1]);
    }
  }
  if (!lons.length) return null;
  const west = Math.min(...lons);
  const span = Math.min(Math.max(...lons) - west, 359.999);
  const start = ((((west + 180) % 360) + 360) % 360) - 180;
  return [start, Math.min(...lats), start + span, Math.max(...lats)];
}

/** The ground resolution of a view, in km per screen pixel (near the projection's centre). */
export const kmPerPixel = (projection: GeoProjection, k: number): number => 6371 / (projection.scale() * k);
