"use client";

import { geoGraticule10, geoInterpolate, geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { FeatureCollection } from "geojson";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { LatLon } from "@/lib/geo";

export type MapMarker = LatLon & {
  kind: "guess" | "answer" | "ghost";
  label?: string;
  /** Put the label under the dot (default: above, unless near the top edge). */
  labelBelow?: boolean;
};

export type MapArc = { from: LatLon; to: LatLon; kind: "miss" | "life" };

type Labels = {
  loading: string;
  error: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
};

type Props = {
  markers: MapMarker[];
  arcs?: MapArc[];
  /** Makes the map clickable: called with the clicked location. */
  onPick?: (point: LatLon) => void;
  /** The view animates to frame these points whenever they change. */
  focus?: LatLon[];
  labels: Labels;
  ariaLabel: string;
  /** Rendered in the top-left corner of the frame. */
  children?: React.ReactNode;
};

type Size = { width: number; height: number };

const MAX_ZOOM = 80;
const FRAME_INSET = 6;

let worldRequest: Promise<FeatureCollection> | null = null;

function loadWorld(): Promise<FeatureCollection> {
  worldRequest ??= fetch("/geo/countries-50m.json")
    .then((response) => {
      if (!response.ok) throw new Error(`World map: HTTP ${response.status}`);
      return response.json();
    })
    .then((topology: Topology) => {
      const countries = topology.objects.countries as GeometryCollection;
      return feature(topology, countries) as FeatureCollection;
    })
    .catch((error) => {
      worldRequest = null; // let a remount retry
      throw error;
    });
  return worldRequest;
}

// The heavy, static part of the map. Memoised so panning and zooming (which
// only change the parent <g>'s transform) never re-render it.
const BaseMap = memo(function BaseMap({
  sphere,
  graticule,
  land,
}: {
  sphere: string;
  graticule: string;
  land: string | null;
}) {
  return (
    <>
      <path d={sphere} className="map-sea" />
      <path d={graticule} className="map-graticule" />
      {land && <path d={land} className="map-land" />}
      <path d={sphere} className="map-outline" />
    </>
  );
});

export function WorldMap({ markers, arcs = [], onPick, focus, labels, ariaLabel, children }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const homeRef = useRef<ZoomTransform>(zoomIdentity);

  const [size, setSize] = useState<Size | null>(null);
  const [world, setWorld] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<ZoomTransform>(zoomIdentity);

  useEffect(() => {
    let alive = true;
    loadWorld().then(
      (loaded) => alive && setWorld(loaded),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0) {
        setSize((old) =>
          old && old.width === width && old.height === height ? old : { width, height },
        );
      }
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const projection = useMemo(() => {
    if (!size) return null;
    return geoNaturalEarth1()
      .rotate([-11, 0]) // keeps the far east of Russia in one piece
      .fitExtent(
        [
          [FRAME_INSET, FRAME_INSET],
          [size.width - FRAME_INSET, size.height - FRAME_INSET],
        ],
        { type: "Sphere" },
      );
  }, [size]);

  const base = useMemo(() => {
    if (!projection) return null;
    const path = geoPath(projection);
    return {
      sphere: path({ type: "Sphere" }) ?? "",
      graticule: path(geoGraticule10()) ?? "",
      land: world ? path(world) : null,
      bounds: path.bounds({ type: "Sphere" }),
    };
  }, [projection, world]);

  // Pan and zoom. Rebuilt (and the view reset) whenever the frame resizes.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !size || !base) return;
    const { width, height } = size;

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .extent([
        [0, 0],
        [width, height],
      ])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on("zoom", (event) => setView(event.transform));

    // In a tall frame the whole world is a thin strip; start zoomed in a
    // little so the map fills more of it. Zooming back out is always possible.
    const worldHeight = base.bounds[1][1] - base.bounds[0][1];
    const scale = Math.min(Math.max(height / worldHeight, 1), 1.7);
    const home = zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-width / 2, -height / 2);

    const selection = select(svg);
    selection.call(behavior).on("dblclick.zoom", null);
    selection.call(behavior.transform, home);
    zoomRef.current = behavior;
    homeRef.current = home;

    return () => {
      selection.interrupt();
      selection.on(".zoom", null);
      zoomRef.current = null;
    };
  }, [size, base]);

  // Frame the focus points.
  const focusKey = focus?.map((p) => `${p.lat},${p.lon}`).join(";") ?? "";
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior || !projection || !size || !focusKey) return;

    const points = focusKey
      .split(";")
      .map((pair) => pair.split(",").map(Number))
      .map(([lat, lon]) => projection([lon, lat]))
      .filter((point): point is [number, number] => !!point);
    if (!points.length) return;

    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 1);
    const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 1);
    const scale = Math.min(
      Math.max(0.5 * Math.min(size.width / spanX, size.height / spanY), 1),
      14,
    );
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const target = zoomIdentity
      .translate(size.width / 2 - scale * centerX, size.height / 2 - scale * centerY)
      .scale(scale);

    select(svg).transition().duration(1100).call(behavior.transform, target);
  }, [focusKey, projection, size, base]);

  function zoomBy(factor: number) {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg && behavior) select(svg).transition().duration(250).call(behavior.scaleBy, factor);
  }

  function zoomHome() {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg && behavior) {
      select(svg).transition().duration(500).call(behavior.transform, homeRef.current);
    }
  }

  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!onPick || !projection) return;
    const box = event.currentTarget.getBoundingClientRect();
    const [x, y] = view.invert([event.clientX - box.left, event.clientY - box.top]);
    const location = projection.invert?.([x, y]);
    if (!location) return;
    // Clicks outside the globe invert to nonsense that doesn't project back.
    const back = projection(location);
    if (!back || Math.hypot(back[0] - x, back[1] - y) > 0.5) return;
    onPick({ lon: location[0], lat: location[1] });
  }

  const toScreen = (point: LatLon): [number, number] | null => {
    const projected = projection?.([point.lon, point.lat]);
    return projected ? view.apply(projected) : null;
  };

  // Great-circle arc as a screen-space path, broken where it wraps around
  // the edge of the map.
  const arcPath = (arc: MapArc): string => {
    if (!size) return "";
    const along = geoInterpolate([arc.from.lon, arc.from.lat], [arc.to.lon, arc.to.lat]);
    const jump = (size.width * view.k) / 2;
    let d = "";
    let previous: [number, number] | null = null;
    for (let i = 0; i <= 64; i++) {
      const [lon, lat] = along(i / 64);
      const point = toScreen({ lon, lat });
      if (!point) continue;
      const broken = !previous || Math.abs(point[0] - previous[0]) > jump;
      d += `${broken ? "M" : "L"}${point[0].toFixed(1)},${point[1].toFixed(1)}`;
      previous = point;
    }
    return d;
  };

  return (
    <div ref={frameRef} className="map-frame" data-pickable={onPick ? "" : undefined}>
      {size && base && (
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          role="img"
          aria-label={ariaLabel}
          onClick={handleClick}
        >
          <g transform={view.toString()}>
            <BaseMap sphere={base.sphere} graticule={base.graticule} land={base.land} />
          </g>

          {arcs.map((arc, i) => (
            <path
              key={`${focusKey}:${i}`}
              d={arcPath(arc)}
              pathLength={arc.kind === "life" ? 1 : undefined}
              className={`map-arc map-arc-${arc.kind}`}
            />
          ))}

          {markers.map((marker, i) => {
            const point = toScreen(marker);
            if (!point) return null;
            const labelBelow = marker.labelBelow ?? point[1] < 44;
            return (
              <g
                key={`${marker.kind}:${i}`}
                transform={`translate(${point[0].toFixed(1)},${point[1].toFixed(1)})`}
                className={`map-marker map-marker-${marker.kind}`}
              >
                {marker.kind === "answer" && <circle r={7} className="map-marker-pulse" />}
                <circle r={marker.kind === "ghost" ? 4.5 : 7} className="map-marker-dot" />
                {marker.kind !== "ghost" && <circle r={2} className="map-marker-core" />}
                {marker.label && (
                  <text y={labelBelow ? 24 : -14} textAnchor="middle" className="map-marker-label">
                    {marker.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {!world && (
        <p className="map-status" role="status">
          {failed ? labels.error : labels.loading}
        </p>
      )}

      {children && <div className="map-readout">{children}</div>}

      <div className="map-controls">
        <button type="button" onClick={() => zoomBy(1.8)} aria-label={labels.zoomIn} title={labels.zoomIn}>
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.8)} aria-label={labels.zoomOut} title={labels.zoomOut}>
          −
        </button>
        <button type="button" onClick={zoomHome} aria-label={labels.zoomReset} title={labels.zoomReset}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <ellipse cx="8" cy="8" rx="2.6" ry="6.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1.8 8h12.4" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
