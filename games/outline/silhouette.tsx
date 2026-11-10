"use client";

import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoDistance, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Position } from "geojson";
import { useEffect, useState } from "react";
import { loadWorld } from "@/components/world-map";
import type { Country } from "@/lib/countries";

const SIZE = 200;
const MARGIN = 16;

// A far-flung island would shrink the mainland to a dot. A piece of the
// country is drawn when it is big next to the mainland, or close to it.
const BIG_SHARE = 0.2;
const CLOSE_RADII = 3.5;

/** The country's shape as one geometry: its mainland and what lies around it. */
function homeland(shapes: Feature[]): MultiPolygon {
  const pieces = shapes
    .flatMap((shape): Position[][][] =>
      shape.geometry.type === "Polygon"
        ? [shape.geometry.coordinates]
        : shape.geometry.type === "MultiPolygon"
          ? shape.geometry.coordinates
          : [],
    )
    .map((coordinates) => {
      const polygon = { type: "Polygon" as const, coordinates };
      return { coordinates, area: geoArea(polygon), centre: geoCentroid(polygon) };
    });
  const main = pieces.reduce((largest, piece) => (piece.area > largest.area ? piece : largest));
  // The radius, in radians, of a circle as large as the mainland.
  const reach = CLOSE_RADII * Math.sqrt(main.area / Math.PI);
  return {
    type: "MultiPolygon",
    coordinates: pieces
      .filter((piece) => piece.area >= BIG_SHARE * main.area || geoDistance(piece.centre, main.centre) <= reach)
      .map((piece) => piece.coordinates),
  };
}

/** The outline as an SVG path, north up, true to shape wherever the country is. */
function outlinePath(shapes: Feature[]): string {
  const land = homeland(shapes);
  const [lon, lat] = geoCentroid(land);
  const projection = geoAzimuthalEqualArea()
    .rotate([-lon, -lat])
    .fitExtent(
      [
        [MARGIN, MARGIN],
        [SIZE - MARGIN, SIZE - MARGIN],
      ],
      land,
    );
  return geoPath(projection)(land) ?? "";
}

type Props = {
  country: Country;
  /** The puzzle is over: the outline takes the colour of the truth. */
  revealed: boolean;
  label: string;
};

/** A country cut out of the map, with nothing around it to give it away. */
export function Silhouette({ country, revealed, label }: Props) {
  // Kept with the country it was drawn for, so the next puzzle never shows the last one's.
  const [drawn, setDrawn] = useState<{ id: string; path: string } | null>(null);
  const path = drawn?.id === country.id ? drawn.path : null;

  useEffect(() => {
    let alive = true;
    loadWorld().then(
      (world) => {
        const shapes = world.features.filter((shape) => country.shapes.includes(shape.properties?.name));
        if (alive && shapes.length) setDrawn({ id: country.id, path: outlinePath(shapes) });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [country]);

  return (
    <div className="plate silhouette" data-revealed={revealed ? "" : undefined}>
      {path && (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
          <path d={path} />
        </svg>
      )}
    </div>
  );
}
