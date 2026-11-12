"use client";

import {
  geoCircle,
  geoGraticule10,
  geoInterpolate,
  geoNaturalEarth1,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { FeatureCollection } from "geojson";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { LatLon } from "@/lib/geo";
import { useSiteT } from "@/lib/i18n";
import { motionMs } from "@/lib/motion";
import { useShellT } from "@/lib/shell-messages";
import {
  DETAIL_KM_PER_PX,
  boundsOnScreen,
  detailTile,
  detailTilesIn,
  kmPerPixel,
  loadDetailTiles,
  prepareDetail,
} from "./map-detail";

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
  /**
   * The player can drag this marker to fine-tune it (on a map with `onPick`):
   * letting go of it is a pick where it was let go.
   */
  draggable?: boolean;
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

/** A country coloured in. `shape` is its name in the world map's data. */
export type MapRegion = { shape: string; tone?: string };

type Labels = {
  loading: string;
  error: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  /** How to play the map from the keyboard, read when it takes the focus. */
  keys: string;
};

type Props = {
  markers: MapMarker[];
  arcs?: MapArc[];
  routes?: MapRoute[];
  rings?: MapRing[];
  regions?: MapRegion[];
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
type Point = [number, number];

const FRAME_INSET = 6;
/** Keeps the far east of Russia in one piece. */
const ROTATION: [number, number] = [-11, 0];
const EARTH_RADIUS_KM = 6371;
/** At the closest zoom, the frame's shorter side spans this many kilometres: a town, a city's centre. */
const CLOSEST_SPAN_KM = 4;
const MARKER_RADIUS = { guess: 7, answer: 7, ghost: 4.5, stop: 3.2, pin: 11 } as const;
/** The invisible hit area of a marker that can be tapped or dragged: 44px across, the size of a fingertip. */
const HIT_RADIUS = 22;
/** Width of one character of a marker label (11px monospace), for layout. */
const LABEL_CHAR_WIDTH = 6.9;
/** One press of + or −. */
const ZOOM_STEP = 2;

/** A finger that moves less than this (px) taps; more, and it drags the map. */
const TAP_SLOP = 10;
/** A second tap this soon (ms) and this close (px) to the first is a double tap: it zooms in instead of picking. */
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_SLOP = 36;
/** Mouse events this soon (ms) after a touch are the browser's copies of it, not a mouse. */
const TOUCH_ECHO_MS = 800;
/** How long (ms) the view must rest before the detailed land is drawn for it. */
const DETAIL_DELAY_MS = 110;

/** The map's own interface strings, in the player's language. */
export function useMapLabels(): Labels {
  const t = useSiteT();
  const shell = useShellT();
  return {
    loading: t("mapLoading"),
    error: t("mapError"),
    zoomIn: t("zoomIn"),
    zoomOut: t("zoomOut"),
    zoomReset: t("zoomReset"),
    keys: shell("mapKeys"),
  };
}

/** How far one press of an arrow key moves the keyboard cursor, in screen pixels (Shift: four times as far). */
const CURSOR_STEP = 12;
/** The cursor stays this far inside the frame; past it, the map pans instead. */
const CURSOR_MARGIN = 28;

let worldRequest: Promise<FeatureCollection> | null = null;

/** The world's countries, fetched once and shared by every map on the page. */
export function loadWorld(): Promise<FeatureCollection> {
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

/** The view a frame opens on: the whole world, a little closer in a tall frame. */
function homeView(projection: GeoProjection, { width, height }: Size): ZoomTransform {
  const bounds = geoPath(projection).bounds({ type: "Sphere" });
  // In a tall frame the whole world is a thin strip; start zoomed in so the
  // map fills more of it — most of the height on a phone held upright, where
  // the frame is the screen. Zooming back out is always possible.
  const worldHeight = bounds[1][1] - bounds[0][1];
  const tall = height > width * 1.15;
  const scale = Math.min(Math.max((height / worldHeight) * (tall ? 0.94 : 1), 1), tall ? 2.3 : 1.7);
  return zoomIdentity
    .translate(width / 2, height / 2)
    .scale(scale)
    .translate(-width / 2, -height / 2);
}

/** The map's projection, filling a frame. */
const frameProjection = ({ width, height }: Size): GeoProjection =>
  geoNaturalEarth1()
    .rotate(ROTATION)
    .fitExtent(
      [
        [FRAME_INSET, FRAME_INSET],
        [width - FRAME_INSET, height - FRAME_INSET],
      ],
      { type: "Sphere" },
    );

/** A new projection with a view's pan and zoom built in, so it draws straight to the screen. */
function onScreen(projection: GeoProjection, view: ZoomTransform): GeoProjection {
  const [x, y] = projection.translate();
  return geoNaturalEarth1()
    .rotate(ROTATION)
    .scale(projection.scale() * view.k)
    .translate([x * view.k + view.x, y * view.k + view.y]);
}

/** The detailed land drawn for one view (`at`), straight in screen pixels over the frame and a margin round it. */
type Detail = {
  at: ZoomTransform;
  width: number;
  height: number;
  margin: Point;
  land: string;
  edges: string;
  regionKey: string;
  regions: { shape: string; tone: string; fill: string; edges: string }[];
};

/** How the detail drawn for one view moves to sit under another: scale `k`, then shift. */
function detailShift(detail: Detail, view: ZoomTransform) {
  const k = view.k / detail.at.k;
  return { k, x: view.x - k * detail.at.x, y: view.y - k * detail.at.y };
}

/** Does the detail (and its margin) still cover the whole frame at this view, sharply enough? */
function detailCovers(detail: Detail, view: ZoomTransform, size: Size): boolean {
  if (detail.width !== size.width || detail.height !== size.height) return false;
  const { k, x, y } = detailShift(detail, view);
  if (k < 0.5 || k > 2.5) return false;
  const [mx, my] = detail.margin;
  return (
    -x / k >= -mx - 1 &&
    -y / k >= -my - 1 &&
    (size.width - x) / k <= size.width + mx + 1 &&
    (size.height - y) / k <= size.height + my + 1
  );
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

/** A touch (or pen) gesture on the map, or a marker being dragged. */
type Gesture = {
  mode: "tap" | "pan" | "pinch" | "drag";
  pointers: Map<number, Point>;
  /** Where the first finger came down, and when. */
  start: Point;
  time: number;
  /** The view when the current pan or pinch began… */
  base: ZoomTransform;
  /** …and the finger (pan) or the middle of the two fingers (pinch) then. */
  anchor: Point;
  /** The fingers' distance apart when the pinch began. */
  spread: number;
  touch: boolean;
  /** No tap: the fingers moved, or there were two. */
  moved: boolean;
  /** A tap on a selectable marker selects it. */
  select?: () => void;
};

export function WorldMap({
  markers,
  arcs = [],
  routes = [],
  rings = [],
  regions = [],
  onPick,
  focus,
  labels,
  ariaLabel,
  children,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // The size and projection the view was last laid out for, to carry it over a resize.
  const layoutRef = useRef<{ size: Size; projection: GeoProjection; home: ZoomTransform } | null>(null);
  const focusedRef = useRef<string | null>(null);
  const flyingRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingTapRef = useRef<{ at: Point; time: number; timer: ReturnType<typeof setTimeout>; fire: () => void } | null>(null);
  const lastTouchRef = useRef(-Infinity);
  const suppressClickRef = useRef(-Infinity);
  const pickRef = useRef(onPick);

  const [size, setSize] = useState<Size | null>(null);
  const [world, setWorld] = useState<FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<ZoomTransform>(zoomIdentity);
  // The keyboard's cursor, in screen pixels: shown while a pickable map has the focus.
  const [cursor, setCursor] = useState<Point | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  // Where a dragged marker is, in screen pixels, until it is let go.
  const [dragAt, setDragAt] = useState<Point | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [detailFailed, setDetailFailed] = useState(false);

  useEffect(() => {
    pickRef.current = onPick;
  });

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
    return () => {
      observer.disconnect();
      if (pendingTapRef.current) clearTimeout(pendingTapRef.current.timer);
    };
  }, []);

  const projection = useMemo(() => (size ? frameProjection(size) : null), [size]);

  const base = useMemo(() => {
    if (!projection) return null;
    const path = geoPath(projection);
    return {
      sphere: path({ type: "Sphere" }) ?? "",
      graticule: path(geoGraticule10()) ?? "",
      land: world ? path(world) : null,
    };
  }, [projection, world]);

  const home = useMemo(() => (projection && size ? homeView(projection, size) : zoomIdentity), [projection, size]);
  // Deep enough for a town to fill the frame.
  const maxZoom = useMemo(
    () =>
      projection && size
        ? Math.max(
            (EARTH_RADIUS_KM * Math.min(size.width, size.height)) / (CLOSEST_SPAN_KM * projection.scale()),
            home.k * 8,
          )
        : 1,
    [projection, size, home],
  );

  // Regions are whole countries from the map's own data, drawn over the land.
  const regionKey = regions.map((region) => `${region.shape}|${region.tone ?? ""}`).join(";");
  const regionPaths = useMemo(() => {
    if (!projection || !world || !regionKey) return [];
    const path = geoPath(projection);
    return regionKey.split(";").flatMap((entry) => {
      const [shape, tone] = entry.split("|");
      const country = world.features.find((item) => item.properties?.name === shape);
      const d = country ? path(country) : null;
      return d ? [{ shape, d, tone }] : [];
    });
  }, [projection, world, regionKey]);

  // Pan and zoom: the mouse wheel and mouse drags are d3-zoom's; touch is
  // handled below (handlePointer…), so that it can share the page's scrolling.
  const ready = !!base;
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !ready) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .filter((event: Event) => {
        const target = event.target as Element | null;
        if (event.type === "wheel") return true;
        // The browser's mouse copies of a touch, a dragged marker and the
        // double-click of a map that is picked by clicking are not ours.
        if (performance.now() - lastTouchRef.current < TOUCH_ECHO_MS) return false;
        if (target?.closest?.("[data-drag]")) return false;
        if (event.type === "dblclick" && pickRef.current) return false;
        const mouse = event as MouseEvent;
        return !mouse.ctrlKey && !mouse.button;
      })
      // A little faster than d3's default, for the longer way down to a city.
      .wheelDelta(
        (event: WheelEvent) =>
          -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1.5),
      )
      .on("zoom", (event) => setView(event.transform));
    const selection = select(svg);
    selection.call(behavior).on("touchstart.zoom touchmove.zoom touchend.zoom touchcancel.zoom", null);
    zoomRef.current = behavior;
    return () => {
      selection.interrupt();
      selection.on(".zoom", null);
      zoomRef.current = null;
      layoutRef.current = null;
      focusedRef.current = null;
    };
  }, [ready]);

  // Fit the frame: the home view the first time; after a resize (a phone
  // turned on its side), the same place in the middle at the same ground scale.
  // Before the browser paints, so a resize never shows the old view.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior || !size || !projection || !ready) return;
    const { width, height } = size;
    const extent: [Point, Point] = [
      [0, 0],
      [width, height],
    ];
    behavior.extent(extent).translateExtent(extent).scaleExtent([1, maxZoom]);

    let next = home;
    const before = layoutRef.current;
    if (before && (before.size.width !== width || before.size.height !== height)) {
      const current = zoomTransform(svg);
      const atHome =
        Math.abs(current.k / before.home.k - 1) < 0.02 &&
        Math.hypot(current.x - before.home.x, current.y - before.home.y) < 2;
      const middle = before.projection.invert?.(current.invert([before.size.width / 2, before.size.height / 2]));
      if (flyingRef.current) {
        focusedRef.current = null; // the fly-to was cut short: fly again, to the new frame
      } else if (!atHome && middle) {
        const k = Math.min(Math.max((current.k * before.projection.scale()) / projection.scale(), 1), maxZoom);
        const [x, y] = projection(middle) ?? [width / 2, height / 2];
        next = behavior.constrain()(
          zoomIdentity.translate(width / 2 - k * x, height / 2 - k * y).scale(k),
          extent,
          extent,
        );
      }
    } else if (before) {
      next = zoomTransform(svg);
    }
    layoutRef.current = { size, projection, home };
    select(svg).interrupt().call(behavior.transform, next);
  }, [size, projection, home, maxZoom, ready]);

  // Frame the focus points (when they change, not on every resize).
  const focusKey = focus?.map((p) => `${p.lat},${p.lon}`).join(";") ?? "";
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!focusKey) {
      focusedRef.current = null;
      return;
    }
    if (!svg || !behavior || !projection || !size || !ready || focusedRef.current === focusKey) return;
    focusedRef.current = focusKey;

    const points = focusKey
      .split(";")
      .map((pair) => pair.split(",").map(Number))
      .map(([lat, lon]) => projection([lon, lat]))
      .filter((point): point is Point => !!point);
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

    flyingRef.current = true;
    select(svg)
      .transition()
      .duration(motionMs(1100))
      .call(behavior.transform, target)
      .on("end interrupt", () => {
        flyingRef.current = false;
      });
  }, [focusKey, projection, size, ready]);

  // Close in, the everyday map gives way to the detailed one, drawn for the
  // view once it settles (and moved with it until the next drawing).
  const deep = !!projection && kmPerPixel(projection, view.k) <= DETAIL_KM_PER_PX;
  useEffect(() => {
    if (!deep || !projection || !size || detailFailed) return;
    const timer = setTimeout(() => {
      const { width, height } = size;
      const margin: Point = [width / 2, height / 2];
      const invert = (point: Point): Point | null => {
        const at = view.invert(point);
        const location = projection.invert?.(at);
        const back = location && projection(location);
        return back && Math.hypot(back[0] - at[0], back[1] - at[1]) < 1 ? (location as Point) : null;
      };
      const box = boundsOnScreen(invert, -margin[0], -margin[1], width + margin[0], height + margin[1]);
      if (!box) return;
      const keys = detailTilesIn(...box);
      const retry = () => setDetailVersion((version) => version + 1);
      const fail = () => setDetailFailed(true);
      if (!keys) return void prepareDetail().then(retry, fail);
      const missing = keys.filter((key) => !detailTile(key));
      if (missing.length) return void loadDetailTiles(missing).then(retry, fail);

      const path = geoPath(
        onScreen(projection, view)
          .precision(0)
          .clipExtent([
            [-margin[0], -margin[1]],
            [width + margin[0], height + margin[1]],
          ]),
      ).digits(1);
      const tones = new Map(
        regionKey ? regionKey.split(";").map((entry) => entry.split("|") as [string, string]) : [],
      );
      const regionParts = new Map<string, { fill: string; edges: string }>();
      let land = "";
      let edges = "";
      for (const key of keys) {
        for (const shape of detailTile(key) ?? []) {
          const fill = path(shape.fill) ?? "";
          const edge = path(shape.edges) ?? "";
          land += fill;
          edges += edge;
          if (tones.has(shape.name)) {
            const part = regionParts.get(shape.name) ?? { fill: "", edges: "" };
            regionParts.set(shape.name, { fill: part.fill + fill, edges: part.edges + edge });
          }
        }
      }
      setDetail({
        at: view,
        width,
        height,
        margin,
        land,
        edges,
        regionKey,
        regions: [...regionParts].map(([shape, part]) => ({ shape, tone: tones.get(shape) ?? "", ...part })),
      });
    }, DETAIL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [deep, view, projection, size, regionKey, detailVersion, detailFailed]);

  const showDetail = deep && !!size && !!detail && detailCovers(detail, view, size);
  const detailRegions = showDetail && detail.regionKey === regionKey;

  function zoomBy(factor: number, point?: Point) {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg && behavior) {
      select(svg).transition().duration(motionMs(280)).call(behavior.scaleBy, factor, point);
    }
  }

  function zoomHome() {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg && behavior) {
      select(svg).transition().duration(motionMs(500)).call(behavior.transform, home);
    }
  }

  /** The place under a point of the frame (screen pixels), if it is on the globe. */
  function locate(screenX: number, screenY: number): LatLon | null {
    if (!projection) return null;
    const [x, y] = view.invert([screenX, screenY]);
    const location = projection.invert?.([x, y]);
    if (!location) return null;
    // Clicks outside the globe invert to nonsense that doesn't project back.
    const back = projection(location);
    if (!back || Math.hypot(back[0] - x, back[1] - y) > 0.5) return null;
    return { lon: location[0], lat: location[1] };
  }

  /** Picks the place under a point of the frame (screen pixels), if it is on the globe. */
  function pickAt(screenX: number, screenY: number) {
    if (!onPick) return;
    const location = locate(screenX, screenY);
    if (location) onPick(location);
  }

  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    // A tap was handled as it ended (handlePointerUp); a drag ends in no click.
    const now = performance.now();
    if (now - lastTouchRef.current < TOUCH_ECHO_MS || now < suppressClickRef.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    pickAt(event.clientX - box.left, event.clientY - box.top);
  }

  // ── Touch: one finger pans (or, at the home view, leaves an up-and-down
  // drag to scroll the page: CSS touch-action), two pinch, a tap picks after
  // a short wait for a second one, and a double tap zooms in where it lands.

  const pointOf = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };

  function applyView(next: ZoomTransform) {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior || !size) return;
    const extent: [Point, Point] = [
      [0, 0],
      [size.width, size.height],
    ];
    select(svg).call(behavior.transform, behavior.constrain()(next, extent, extent));
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    setKeyboard(false);
    const svg = svgRef.current;
    if (!svg) return;
    const touch = event.pointerType !== "mouse";
    if (touch) lastTouchRef.current = performance.now();
    const target = event.target as Element;
    const draggable = !!onPick && !!target.closest("[data-drag]");
    if (!touch && !(draggable && event.button === 0)) return; // the mouse is d3-zoom's
    const at = pointOf(event);
    const gesture = gestureRef.current;

    if (gesture) {
      // Only a second finger joins a gesture under way, to pinch.
      if (!touch || !gesture.touch || gesture.mode === "drag" || gesture.pointers.size >= 2) return;
      // A second finger: pinch.
      gesture.pointers.set(event.pointerId, at);
      const [a, b] = [...gesture.pointers.values()];
      Object.assign(gesture, {
        mode: "pinch",
        moved: true,
        base: zoomTransform(svg),
        anchor: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        spread: Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), 1),
      });
      return;
    }

    select(svg).interrupt();
    svg.setPointerCapture?.(event.pointerId);
    const selectable = target.closest("[data-select]");
    gestureRef.current = {
      mode: draggable ? "drag" : "tap",
      pointers: new Map([[event.pointerId, at]]),
      start: at,
      time: performance.now(),
      base: zoomTransform(svg),
      anchor: at,
      spread: 1,
      touch,
      moved: false,
      select: selectable ? markers[Number(selectable.getAttribute("data-select"))]?.onSelect : undefined,
    };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const gesture = gestureRef.current;
    if (!gesture || !gesture.pointers.has(event.pointerId)) return;
    const at = pointOf(event);
    gesture.pointers.set(event.pointerId, at);
    const dx = at[0] - gesture.start[0];
    const dy = at[1] - gesture.start[1];

    if (gesture.mode === "drag") {
      if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
      gesture.moved = true;
      setDragAt(at);
    } else if (gesture.mode === "tap") {
      if (Math.hypot(dx, dy) < TAP_SLOP) return;
      gesture.moved = true;
      // At the home view an up-and-down drag is the page's (it scrolls, and
      // the browser cancels the pointer); only a sideways one pans the map.
      if (!zoomed && Math.abs(dy) > Math.abs(dx)) return;
      gesture.mode = "pan";
      gesture.anchor = gesture.start;
      handlePointerMove(event);
    } else if (gesture.mode === "pan") {
      const { base, anchor } = gesture;
      applyView(zoomIdentity.translate(base.x + at[0] - anchor[0], base.y + at[1] - anchor[1]).scale(base.k));
    } else if (gesture.mode === "pinch" && gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()];
      const middle: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const spread = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), 1);
      const { base, anchor } = gesture;
      const k = Math.min(Math.max((base.k * spread) / gesture.spread, 1), maxZoom);
      // The place that was between the fingers stays between them.
      const [x, y] = base.invert(anchor);
      applyView(zoomIdentity.translate(middle[0] - k * x, middle[1] - k * y).scale(k));
    }
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const gesture = gestureRef.current;
    if (!gesture || !gesture.pointers.has(event.pointerId)) return;
    if (gesture.touch) lastTouchRef.current = performance.now();
    const at = pointOf(event);
    const cancelled = event.type === "pointercancel";
    gesture.pointers.delete(event.pointerId);

    if (gesture.pointers.size) {
      // One finger of a pinch lifted: the other pans on from where it is.
      const svg = svgRef.current;
      const [rest] = [...gesture.pointers.values()];
      if (svg) Object.assign(gesture, { mode: "pan", base: zoomTransform(svg), anchor: rest, start: rest });
      return;
    }
    gestureRef.current = null;
    if (cancelled) {
      setDragAt(null);
      return;
    }

    if (gesture.mode === "drag") {
      if (gesture.moved) {
        pickAt(at[0], at[1]);
        setDragAt(null);
        suppressClickRef.current = performance.now() + 400;
        return;
      }
      if (!gesture.touch) return; // a click without a drag: handleClick
    } else if (gesture.mode !== "tap" || gesture.moved) {
      return;
    }
    handleTap(at, gesture.select);
  }

  function handleTap(at: Point, selectMarker?: () => void) {
    const now = performance.now();
    const pending = pendingTapRef.current;
    if (pending) {
      clearTimeout(pending.timer);
      pendingTapRef.current = null;
      if (now - pending.time < DOUBLE_TAP_MS && Math.hypot(at[0] - pending.at[0], at[1] - pending.at[1]) < DOUBLE_TAP_SLOP) {
        // The second tap of a double tap only zooms; the first never picked.
        zoomBy(ZOOM_STEP, at);
        return;
      }
      pending.fire();
    }
    if (selectMarker) {
      selectMarker();
      return;
    }
    // Wait a moment: this may be the first tap of a double tap.
    const location = locate(at[0], at[1]);
    const fire = () => {
      if (location) pickRef.current?.(location);
    };
    pendingTapRef.current = {
      at,
      time: now,
      fire,
      timer: setTimeout(() => {
        pendingTapRef.current = null;
        fire();
      }, DOUBLE_TAP_MS),
    };
  }

  // Keyboard play: the arrow keys move a cursor (panning the map at the edges),
  // Enter or Space drops the pin under it, + and - zoom, 0 shows the whole world.
  function handleKey(event: React.KeyboardEvent<SVGSVGElement>) {
    if (!size) return;
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    const at = cursor ?? [size.width / 2, size.height / 2];
    const step = CURSOR_STEP * (event.shiftKey ? 4 : 1);
    const moves: Record<string, Point> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setKeyboard(true);
      const x = at[0] + move[0];
      const y = at[1] + move[1];
      const clampedX = Math.min(Math.max(x, CURSOR_MARGIN), size.width - CURSOR_MARGIN);
      const clampedY = Math.min(Math.max(y, CURSOR_MARGIN), size.height - CURSOR_MARGIN);
      // Past the margin the cursor stays put and the world slides under it.
      if (svg && behavior && (clampedX !== x || clampedY !== y)) {
        select(svg).call(behavior.translateBy, (clampedX - x) / view.k, (clampedY - y) / view.k);
      }
      setCursor([clampedX, clampedY]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setKeyboard(true);
      pickAt(at[0], at[1]);
      if (!cursor) setCursor(at);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      // Zoom in on the cursor, if it is showing.
      zoomBy(ZOOM_STEP, keyboard && cursor ? cursor : undefined);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      zoomHome();
    }
  }

  // Zoomed in, every drag on the map is the map's; at the home view, the page
  // keeps its up-and-down scrolling (see .map-frame's touch-action).
  const zoomed = view.k > home.k * 1.02;
  const canZoomIn = view.k < maxZoom * 0.999;
  const canZoomOut = view.k > 1.001;

  const screen = projection && size ? onScreen(projection, view) : null;
  const toScreen = (point: LatLon): Point | null => screen?.([point.lon, point.lat]) ?? null;

  // Rings are drawn straight to the screen, clipped to the frame, so they stay
  // exact however far in the map is zoomed. As lines, not polygons, so a ring
  // cut by the edge of the map isn't closed along it.
  const ringPaths =
    projection && size && rings.length
      ? (() => {
          const path = geoPath(
            onScreen(projection, view).clipExtent([
              [-size.width, -size.height],
              [size.width * 2, size.height * 2],
            ]),
          ).digits(1);
          return rings.map((ring) => {
            const circle = geoCircle()
              .center([ring.lon, ring.lat])
              .radius((ring.km / EARTH_RADIUS_KM) * (180 / Math.PI))
              .precision(1.5)();
            return { d: path({ type: "LineString", coordinates: circle.coordinates[0] }) ?? "", tone: ring.tone };
          });
        })()
      : [];

  // Great-circle arc as a screen-space path, broken where it wraps around
  // the edge of the map.
  const arcPath = (arc: MapArc): string => {
    if (!size) return "";
    const along = geoInterpolate([arc.from.lon, arc.from.lat], [arc.to.lon, arc.to.lat]);
    const jump = (size.width * view.k) / 2;
    let d = "";
    let previous: Point | null = null;
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
    let previous: Point | null = null;
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
  const dragIndex = onPick ? markers.findIndex((marker) => marker.draggable) : -1;
  const dots = markers.map((marker, i) => ({
    marker,
    point: i === dragIndex && dragAt ? dragAt : toScreen(marker),
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

  const drawn = showDetail ? detail : null;
  const shift = drawn ? detailShift(drawn, view) : null;

  return (
    <div
      ref={frameRef}
      className="map-frame"
      data-pickable={onPick ? "" : undefined}
      data-zoomed={zoomed ? "" : undefined}
    >
      {size && base && (
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          {...(onPick
            ? {
                // A pickable map is played from the keyboard too (handleKey).
                role: "application",
                tabIndex: 0,
                "aria-roledescription": "map",
                "aria-label": `${ariaLabel}. ${labels.keys}`,
                onKeyDown: handleKey,
                onFocus: () => setCursor((at) => at ?? [size.width / 2, size.height / 2]),
                onBlur: () => setKeyboard(false),
              }
            : { role: "img", "aria-label": ariaLabel })}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <g transform={view.toString()} data-detail={showDetail ? "" : undefined}>
            <BaseMap sphere={base.sphere} graticule={base.graticule} land={base.land} />
            {!detailRegions &&
              regionPaths.map((region) => (
                <path key={region.shape} d={region.d} className="map-region" data-tone={region.tone || undefined} />
              ))}
          </g>

          {drawn && shift && (
            <g
              className="map-detail"
              transform={`translate(${shift.x.toFixed(2)},${shift.y.toFixed(2)}) scale(${shift.k.toFixed(5)})`}
            >
              <path d={drawn.land} className="map-detail-land" />
              {detailRegions &&
                drawn.regions.map((region) => (
                  <path
                    key={region.shape}
                    d={region.fill}
                    className="map-region"
                    data-part="fill"
                    data-tone={region.tone || undefined}
                  />
                ))}
              <path d={drawn.edges} className="map-detail-edge" />
              {detailRegions &&
                drawn.regions.map((region) => (
                  <path
                    key={region.shape}
                    d={region.edges}
                    className="map-region"
                    data-part="edge"
                    data-tone={region.tone || undefined}
                  />
                ))}
            </g>
          )}

          {ringPaths.map((ring, i) => (
            <path key={i} d={ring.d} className="map-ring" data-tone={ring.tone || undefined} />
          ))}

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
            const drag = i === dragIndex;
            return (
              <g
                key={`${marker.kind}:${i}`}
                transform={`translate(${point[0].toFixed(1)},${point[1].toFixed(1)})`}
                className={`map-marker map-marker-${marker.kind}`}
                data-tone={marker.tone}
                data-drag={drag ? "" : undefined}
                data-dragging={drag && dragAt ? "" : undefined}
                {...(select && {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": marker.title,
                  "data-select": i,
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation();
                    // A tap selected it already (handleTap).
                    if (performance.now() - lastTouchRef.current >= TOUCH_ECHO_MS) select();
                  },
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select();
                    }
                  },
                })}
              >
                {(select || drag) && <circle r={Math.max(radius + 7, HIT_RADIUS)} className="map-marker-hit" />}
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

          {onPick && keyboard && cursor && (
            <g className="map-cursor" transform={`translate(${cursor[0]},${cursor[1]})`} aria-hidden="true">
              <circle r={11} />
              <path d="M-18 0h10M8 0h10M0-18v10M0 8v10" />
            </g>
          )}
        </svg>
      )}

      {!world && (
        <p className="map-status" role="status">
          {failed ? labels.error : labels.loading}
        </p>
      )}

      {children && <div className="map-readout">{children}</div>}

      <div className="map-controls">
        <button
          type="button"
          onClick={() => canZoomIn && zoomBy(ZOOM_STEP)}
          aria-label={labels.zoomIn}
          aria-disabled={!canZoomIn || undefined}
          title={labels.zoomIn}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => canZoomOut && zoomBy(1 / ZOOM_STEP)}
          aria-label={labels.zoomOut}
          aria-disabled={!canZoomOut || undefined}
          title={labels.zoomOut}
        >
          −
        </button>
        <button type="button" onClick={zoomHome} aria-label={labels.zoomReset} title={labels.zoomReset}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <ellipse cx="8" cy="8" rx="2.6" ry="6.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1.8 8h12.4" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
