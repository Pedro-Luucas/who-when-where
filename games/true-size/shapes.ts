import { geoAzimuthalEqualArea, geoMercator, geoPath, type GeoProjection } from "d3-geo";
import type { FeatureCollection, MultiPolygon, Position } from "geojson";
import type { Entry } from "./data";

// The pair's two countries drawn from the world map: as the familiar web map
// draws them (Mercator, one scale for both, so land far from the equator
// swells), and at true scale (an equal-area projection centred on each
// country, one scale for both).

/** The web map stops at 80° north and south here (as in scripts/build-true-size.mjs). */
const MAX_LAT = 80;
const MERCATOR_EDGE = Math.log(Math.tan(Math.PI / 4 + (MAX_LAT * Math.PI) / 360));

/**
 * The land the game draws for a country: every polygon of its shapes, in the
 * world map's order, without the far-flung pieces the build script left out.
 */
export function landOf(world: FeatureCollection, entry: Entry): MultiPolygon {
  const pieces = world.features
    .filter((shape) => entry.country.shapes.includes(shape.properties?.name))
    .flatMap((shape): Position[][][] =>
      shape.geometry.type === "Polygon"
        ? [shape.geometry.coordinates]
        : shape.geometry.type === "MultiPolygon"
          ? shape.geometry.coordinates
          : [],
    );
  const drop = new Set(entry.size.drop ?? []);
  return { type: "MultiPolygon", coordinates: pieces.filter((_, i) => !drop.has(i)) };
}

type Box = [[number, number], [number, number]];

const mercator = (entry: Entry, scale: number, [tx, ty]: [number, number]): GeoProjection =>
  geoMercator()
    .rotate([-entry.size.lon, 0])
    .scale(scale)
    .translate([tx, ty])
    .clipExtent([
      [tx - 10 * scale, ty - MERCATOR_EDGE * scale],
      [tx + 10 * scale, ty + MERCATOR_EDGE * scale],
    ]);

const equalArea = (entry: Entry, scale: number, translate: [number, number]): GeoProjection =>
  geoAzimuthalEqualArea()
    .rotate([-entry.size.lon, -entry.size.lat])
    .scale(scale)
    .translate(translate);

const boundsOf = (projection: GeoProjection, land: MultiPolygon): Box => geoPath(projection).bounds(land) as Box;

/**
 * Two panels of the same size, one country in each, drawn at one Mercator
 * scale: the largest that fits both.
 */
export function mercatorPanels(
  pair: [Entry, Entry],
  lands: [MultiPolygon, MultiPolygon],
  width: number,
  height: number,
  margin: number,
): [string, string] {
  const boxes = pair.map((entry, i) => boundsOf(mercator(entry, 1, [0, 0]), lands[i]));
  const scale = Math.min(
    ...boxes.map(([[x0, y0], [x1, y1]]) =>
      Math.min((width - 2 * margin) / Math.max(x1 - x0, 1e-9), (height - 2 * margin) / Math.max(y1 - y0, 1e-9)),
    ),
  );
  return pair.map((entry, i) => {
    const [[x0, y0], [x1, y1]] = boxes[i];
    const translate: [number, number] = [width / 2 - (scale * (x0 + x1)) / 2, height / 2 - (scale * (y0 + y1)) / 2];
    return geoPath(mercator(entry, scale, translate))(lands[i]) ?? "";
  }) as [string, string];
}

/**
 * Both countries at true scale, each centred on the middle of the frame: the
 * largest scale at which both fit. The overlay is then moved by the player.
 */
export function trueScale(
  pair: [Entry, Entry],
  lands: [MultiPolygon, MultiPolygon],
  width: number,
  height: number,
  margin: number,
): [string, string] {
  const reach = pair.map((entry, i) => {
    const [[x0, y0], [x1, y1]] = boundsOf(equalArea(entry, 1, [0, 0]), lands[i]);
    return { x: Math.max(-x0, x1, 1e-9), y: Math.max(-y0, y1, 1e-9) };
  });
  const scale = Math.min(
    (width / 2 - margin) / Math.max(...reach.map((r) => r.x)),
    (height / 2 - margin) / Math.max(...reach.map((r) => r.y)),
  );
  return pair.map((entry, i) => geoPath(equalArea(entry, scale, [width / 2, height / 2]))(lands[i]) ?? "") as [
    string,
    string,
  ];
}
