"use client";

import { geoCircle, geoGraticule10, geoInterpolate, geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { FeatureCollection } from "geojson";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { LatLon } from "@/lib/geo";
import { useSiteT } from "@/lib/i18n";

export type MapMarker = LatLon & {
  /**
   * guess: the player's mark · answer: the truth · ghost: a muted reference
   * · stop: a small waypoint · pin: a larger badge that can be tapped.
   */
  kind: "guess" | "answer" | "ghost" | "stop" | "pin";
  label?: string;
  /** Put the label under the dot (default: above, unless near the top edge). */
  labelBelow?: boolean;
  /** One or two characters drawn inside the dot. */
  badge?: string;
  /** Styling hook, exposed as data-tone on the marker. */
  tone?: string;
  /** Makes the marker a button. */
  onSelect?: () => void;
  /** Accessible name for a selectable marker. */
  title?: string;
};

export type MapArc = { from: LatLon; to: LatLon; kind: "miss" | "life" };

/** A line through several points, e.g. a voyage. */
export type MapRoute = {
  points: LatLon[];
  kind: "route" | "thread";
  /** Animate the line being drawn; change `id` to replay it. */
  draw?: boolean;
  id?: string;
};

/** A circle of constant distance around a point. */
export type MapRing = LatLon & { km: number; tone?: string };

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
  routes?: MapRoute[];
  rings?: MapRing[];
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
const EARTH_RADIUS_KM = 6371;
const MARKER_RADIUS = { guess: 7, answer: 7, ghost: 4.5, stop: 3.2, pin: 11 } as const;
/** Width of one character of a marker label (11px monospace), for layout. */
const LABEL_CHAR_WIDTH = 6.9;

/** The map's own interface strings, in the player's language. */
export function useMapLabels(): Labels {
  const t = useSiteT();
  return {
    loading: t("mapLoading"),
    error: t("mapError"),
    zoomIn: t("zoomIn"),
    zoomOut: t("zoomOut"),
    zoomReset: t("zoomReset"),
  };
}

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

export function WorldMap({
  markers,
  arcs = [],
  routes = [],
  rings = [],
  onPick,
  focus,
  labels,
  ariaLabel,
  children,
}: Props) {
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

  // Rings are drawn in map space, inside the zoomed group. As lines, not
  // polygons, so a ring cut by the edge of the map isn't closed along it.
  const ringKey = rings.map((r) => `${r.lat},${r.lon},${r.km},${r.tone ?? ""}`).join(";");
  const ringPaths = useMemo(() => {
    if (!projection || !ringKey) return [];
    const path = geoPath(projection);
    return ringKey.split(";").map((entry) => {
      const [lat, lon, km, tone] = entry.split(",");
      const circle = geoCircle()
        .center([Number(lon), Number(lat)])
        .radius((Number(km) / EARTH_RADIUS_KM) * (180 / Math.PI))
        .precision(1.5)();
      const d = path({ type: "LineString", coordinates: circle.coordinates[0] }) ?? "";
      return { d, tone };
    });
  }, [projection, ringKey]);

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

  // A line through waypoints, straight in longitude/latitude between them
  // (taking the short way round), broken at the edge of the map like arcs.
  const routePath = (points: LatLon[]): string => {
    if (!size) return "";
    const jump = (size.width * view.k) / 2;
    let d = "";
    let previous: [number, number] | null = null;
    const add = (lat: number, lon: number) => {
      const point = toScreen({ lat, lon });
      if (!point) return;
      const broken = !previous || Math.abs(point[0] - previous[0]) > jump;
      d += `${broken ? "M" : "L"}${point[0].toFixed(1)},${point[1].toFixed(1)}`;
      previous = point;
    };
    points.forEach((to, i) => {
      if (i === 0) return add(to.lat, to.lon);
      const from = points[i - 1];
      const dLon = ((((to.lon - from.lon) % 360) + 540) % 360) - 180;
      const dLat = to.lat - from.lat;
      const span = Math.max(Math.abs(dLon), Math.abs(dLat));
      const steps = Math.min(Math.max(Math.ceil(span / 3), 1), 40);
      for (let s = 1; s <= steps; s++) {
        add(from.lat + (dLat * s) / steps, from.lon + (dLon * s) / steps);
      }
    });
    return d;
  };

  // Lay out the markers. Each label goes above or below its dot, wherever it
  // doesn't run into another marker or an earlier label; one with no room is
  // left out until the player zooms in and the dots move apart.
  type Box = { x1: number; y1: number; x2: number; y2: number; owner: number };
  const touching = (a: Box, b: Box) =>
    a.owner !== b.owner && a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
  const dots = markers.map((marker) => ({
    marker,
    point: toScreen(marker),
    radius: marker.badge && marker.kind !== "pin" ? 9 : MARKER_RADIUS[marker.kind],
  }));
  const taken: Box[] = dots.flatMap(({ point, radius }, owner) =>
    point
      ? [{ x1: point[0] - radius, y1: point[1] - radius, x2: point[0] + radius, y2: point[1] + radius, owner }]
      : [],
  );
  const placed = dots.map((dot, owner) => {
    const { marker, point, radius } = dot;
    if (!point || !marker.label) return { ...dot, labelY: null };
    const halfWidth = (marker.label.length * LABEL_CHAR_WIDTH) / 2 + 2;
    const below = marker.labelBelow ?? point[1] < 44;
    for (const side of [below, !below]) {
      const labelY = side ? radius + 17 : -radius - 7;
      const box: Box = {
        x1: point[0] - halfWidth,
        x2: point[0] + halfWidth,
        y1: point[1] + labelY - 10,
        y2: point[1] + labelY + 3,
        owner,
      };
      if (!taken.some((other) => touching(other, box))) {
        taken.push(box);
        return { ...dot, labelY };
      }
    }
    return { ...dot, labelY: null };
  });

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
            {ringPaths.map((ring, i) => (
              <path key={i} d={ring.d} className="map-ring" data-tone={ring.tone || undefined} />
            ))}
          </g>

          {routes.map((route, i) => (
            <path
              key={route.id ?? i}
              d={routePath(route.points)}
              pathLength={route.draw ? 1 : undefined}
              className={`map-route map-route-${route.kind}`}
              data-draw={route.draw ? "" : undefined}
            />
          ))}

          {arcs.map((arc, i) => (
            <path
              key={`${focusKey}:${i}`}
              d={arcPath(arc)}
              pathLength={arc.kind === "life" ? 1 : undefined}
              className={`map-arc map-arc-${arc.kind}`}
            />
          ))}

          {placed.map(({ marker, point, radius, labelY }, i) => {
            if (!point) return null;
            const select = marker.onSelect;
            return (
              <g
                key={`${marker.kind}:${i}`}
                transform={`translate(${point[0].toFixed(1)},${point[1].toFixed(1)})`}
                className={`map-marker map-marker-${marker.kind}`}
                data-tone={marker.tone}
                {...(select && {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": marker.title,
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation();
                    select();
                  },
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select();
                    }
                  },
                })}
              >
                {select && <circle r={radius + 7} className="map-marker-hit" />}
                {marker.kind === "answer" && <circle r={7} className="map-marker-pulse" />}
                <circle r={radius} className="map-marker-dot" />
                {marker.badge ? (
                  <text y={3.6} textAnchor="middle" className="map-marker-badge">
                    {marker.badge}
                  </text>
                ) : (
                  (marker.kind === "guess" || marker.kind === "answer") && (
                    <circle r={2} className="map-marker-core" />
                  )
                )}
                {labelY !== null && (
                  <text y={labelY} textAnchor="middle" className="map-marker-label">
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
