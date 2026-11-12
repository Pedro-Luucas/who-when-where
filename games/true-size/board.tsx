"use client";

import type { FeatureCollection } from "geojson";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { loadWorld } from "@/components/world-map";
import { formatNumber, numberLocale, translator, useLocale, type Locale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { PickBoard, type PickRound } from "../engines/pick";
import { pickScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { BANDS, answersOf, bandOf, biggerOf, isTricky, ratioOf, smallerOf, type Band, type Entry, type Pair, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";
import { landOf, mercatorPanels, trueScale } from "./shapes";

type T = ReturnType<typeof translator<(typeof MESSAGES)["en"]>>;
type World = FeatureCollection | "failed" | null;

const BAND_KEY: Record<Band, MessageKey> = { low: "bandLow", mid: "bandMid", high: "bandHigh" };

/** A Mercator panel, one per country. */
const PANEL = { width: 300, height: 220, margin: 10 };
/** The true-scale frame. */
const FRAME = { width: 600, height: 380, margin: 14 };
const SMALL_FRAME = { width: 300, height: 200, margin: 8 };
/** One press of an arrow key moves the overlay this far (Shift: four times as far). */
const STEP = 12;

/** The world map, fetched once for the board. */
function useWorld(): World {
  const [world, setWorld] = useState<World>(null);
  useEffect(() => {
    let alive = true;
    loadWorld().then(
      (loaded) => alive && setWorld(loaded),
      () => alive && setWorld("failed"),
    );
    return () => {
      alive = false;
    };
  }, []);
  return world;
}

/** Areas as people quote them: to the thousand km² (to the hundred under 100,000). */
const roundedArea = (area: number) => (area >= 100_000 ? Math.round(area / 1000) * 1000 : Math.round(area / 100) * 100);

function words(t: T, locale: Locale) {
  const times = new Intl.NumberFormat(numberLocale(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    name: (entry: Entry) => entry.country.name[locale],
    km: (entry: Entry) => t("unitKm2", { n: formatNumber(roundedArea(entry.size.area), locale) }),
    ratio: (pair: Pair) => times.format(ratioOf(pair)),
  };
}

type Words = ReturnType<typeof words>;

/** The pair's two Mercator panels, worked out once per pair and world. */
const mercatorCache = new WeakMap<FeatureCollection, Map<string, [string, string]>>();

function mercatorOf(world: World, pair: Pair): [string, string] | null {
  if (!world || world === "failed") return null;
  const cache = mercatorCache.get(world) ?? new Map<string, [string, string]>();
  mercatorCache.set(world, cache);
  const key = `${pair.a.country.id}:${pair.b.country.id}`;
  let paths = cache.get(key);
  if (!paths) {
    paths = mercatorPanels(
      [pair.a, pair.b],
      [landOf(world, pair.a), landOf(world, pair.b)],
      PANEL.width,
      PANEL.height,
      PANEL.margin,
    );
    cache.set(key, paths);
  }
  return paths;
}

/** One country of the pair as the web map draws it (a skeleton until the map is in). */
function MercatorShape({ paths, i }: { paths: [string, string] | null; i: 0 | 1 }) {
  return (
    <span className="ts-frame" data-view="mercator" data-loading={paths ? undefined : ""}>
      {paths && (
        <svg viewBox={`0 0 ${PANEL.width} ${PANEL.height}`} aria-hidden="true">
          <path d={paths[i]} />
        </svg>
      )}
    </span>
  );
}

/** Above the options of "which is bigger": the options are the two shapes. */
function MercatorTag({ world, t }: { world: World; t: T }) {
  return (
    <div className="ts-scene">
      <p className="ts-tag">{t("tagMercator")}</p>
      {world === "failed" && <p className="hint">{t("loadFailed")}</p>}
    </div>
  );
}

/** The pair as the web map draws it, with the bigger one marked: two panels side by side. */
function MercatorScene({ pair, world, big, t, w }: { pair: Pair; world: World; big: string; t: T; w: Words }) {
  const paths = mercatorOf(world, pair);
  return (
    <figure className="ts-scene" aria-label={t("mercatorLabel", { a: w.name(pair.a), b: w.name(pair.b) })}>
      <figcaption className="ts-tag">{t("tagMercator")}</figcaption>
      <div className="ts-panels">
        {([pair.a, pair.b] as const).map((entry, i) => (
          <div className="ts-panel" key={entry.country.id} data-big={big === entry.country.id ? "" : undefined}>
            <MercatorShape paths={paths} i={i as 0 | 1} />
            <span className="ts-name">{w.name(entry)}</span>
          </div>
        ))}
      </div>
      {world === "failed" && <p className="hint">{t("loadFailed")}</p>}
    </figure>
  );
}

type Offset = [number, number];

/**
 * The pair at true scale: the bigger country as the base, the smaller one
 * over it, translucent, to be dragged about (pointer or arrow keys).
 */
function TrueScene({ pair, world, t, w, compact = false }: { pair: Pair; world: World; t: T; w: Words; compact?: boolean }) {
  const frame = compact ? SMALL_FRAME : FRAME;
  const big = biggerOf(pair);
  const small = smallerOf(pair);
  const paths = useMemo(() => {
    if (!world || world === "failed") return null;
    return trueScale([big, small], [landOf(world, big), landOf(world, small)], frame.width, frame.height, frame.margin);
  }, [world, big, small, frame]);
  const [offset, setOffset] = useState<Offset>([0, 0]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ pointer: number; start: Offset; from: Offset } | null>(null);

  const clamp = ([x, y]: Offset): Offset => [
    Math.max(-frame.width / 2, Math.min(frame.width / 2, x)),
    Math.max(-frame.height / 2, Math.min(frame.height / 2, y)),
  ];

  /** A pointer's position in the frame's own units. */
  function pointAt(event: PointerEvent): Offset | null {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }

  function onPointerDown(event: PointerEvent<SVGGElement>) {
    const start = pointAt(event);
    if (!start) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, start, from: offset };
  }

  function onPointerMove(event: PointerEvent<SVGGElement>) {
    const held = drag.current;
    if (!held || held.pointer !== event.pointerId) return;
    const now = pointAt(event);
    if (now) setOffset(clamp([held.from[0] + now[0] - held.start[0], held.from[1] + now[1] - held.start[1]]));
  }

  function onPointerUp(event: PointerEvent<SVGGElement>) {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    const step = event.shiftKey ? STEP * 4 : STEP;
    const moves: Record<string, Offset> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      // Kept from the board, where the arrow keys move on to the next round.
      event.preventDefault();
      event.stopPropagation();
      setOffset((current) => clamp([current[0] + move[0], current[1] + move[1]]));
    } else if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOffset([0, 0]);
    }
  }

  const moved = offset[0] !== 0 || offset[1] !== 0;

  return (
    <figure
      className="ts-scene"
      data-view="true"
      data-compact={compact ? "" : undefined}
      aria-label={t("trueLabel", { a: w.name(big), b: w.name(small) })}
    >
      {!compact && <figcaption className="ts-tag">{t("tagTrue")}</figcaption>}
      <div className="ts-frame" data-loading={paths ? undefined : ""}>
        {paths && (
          <svg ref={svg} viewBox={`0 0 ${frame.width} ${frame.height}`}>
            <path className="ts-base" d={paths[0]} />
            {compact ? (
              <path className="ts-over" d={paths[1]} />
            ) : (
              <g
                className="ts-over"
                role="button"
                tabIndex={0}
                aria-label={t("moveLabel", { name: w.name(small) })}
                transform={`translate(${offset[0]} ${offset[1]})`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
              >
                <path d={paths[1]} />
              </g>
            )}
          </svg>
        )}
      </div>
      <div className="ts-legend">
        <span className="ts-key" data-role="base">
          <i aria-hidden="true" />
          <b>{w.name(big)}</b>
          {!compact && <span>{w.km(big)}</span>}
        </span>
        <span className="ts-key" data-role="over">
          <i aria-hidden="true" />
          <b>{w.name(small)}</b>
          {!compact && <span>{w.km(small)}</span>}
        </span>
        <strong className="ts-times">{t("times", { r: w.ratio(pair) })}</strong>
        {!compact && (
          <button type="button" className="button button-quiet ts-reset" onClick={() => setOffset([0, 0])} disabled={!moved}>
            {t("reset")}
          </button>
        )}
      </div>
      {compact && isTricky(pair) && <p className="ts-note">{t("looked", { name: w.name(small) })}</p>}
      {world === "failed" && <p className="hint">{t("loadFailed")}</p>}
    </figure>
  );
}

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const w = words(t, locale);
  const world = useWorld();
  const answers = answersOf(puzzle);
  const score = pickScore(answers, moves);

  const rounds: PickRound[] = puzzle.flatMap((pair, i): PickRound[] => {
    const big = biggerOf(pair);
    const small = smallerOf(pair);
    const key = `${pair.a.country.id}:${pair.b.country.id}`;
    const pairLabel = t("pairN", { n: i + 1, total: puzzle.length });
    return [
      {
        key: `${key}:which`,
        eyebrow: `${pairLabel} · ${t("eyebrowWhich")}`,
        prompt: t("promptWhich"),
        // The two shapes are the options, side by side at one scale.
        scene: () => <MercatorTag world={world} t={t} />,
        options: ([pair.a, pair.b] as const).map((entry, side) => ({
          id: entry.country.id,
          label: w.name(entry),
          media: <MercatorShape paths={mercatorOf(world, pair)} i={side as 0 | 1} />,
        })),
        answer: big.country.id,
        reveal: t("revealWhich", { name: w.name(big) }),
        review: t("reviewWhich", { a: w.name(pair.a), b: w.name(pair.b) }),
      },
      {
        key: `${key}:how-much`,
        eyebrow: `${pairLabel} · ${t("eyebrowHowMuch")}`,
        prompt: t("promptHowMuch", { name: w.name(big) }),
        // The true scale would give the ratio away: it comes with the answer.
        scene: (answered) =>
          answered ? (
            <TrueScene pair={pair} world={world} t={t} w={w} />
          ) : (
            <MercatorScene pair={pair} world={world} big={big.country.id} t={t} w={w} />
          ),
        options: BANDS.map((band) => ({ id: band, label: t(BAND_KEY[band]) })),
        answer: bandOf(ratioOf(pair)),
        reveal: t("revealHowMuch", { a: w.name(big), va: w.km(big), b: w.name(small), vb: w.km(small), r: w.ratio(pair) }),
        review: t("reviewHowMuch", { name: w.name(big) }),
      },
    ];
  });

  // The pairs where the map told a lie, and how many of them the player saw through.
  const tricky = puzzle.map((pair, i) => ({ pair, i })).filter(({ pair }) => isTricky(pair));
  const seenThrough = tricky.filter(({ i }) => moves[2 * i] === answers[2 * i]).length;

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      layout="binary"
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(score.points))}
      answer={(tally) => t("answer", { n: tally.correct, total: rounds.length })}
      stats={tricky.length ? [{ label: t("statTricks"), value: `${seenThrough}/${tricky.length}` }] : []}
      after={
        <section className="ts-gallery" aria-label={t("gallery")}>
          <p className="eyebrow">{t("gallery")}</p>
          <ul>
            {puzzle.map((pair) => (
              <li key={`${pair.a.country.id}:${pair.b.country.id}`}>
                <TrueScene pair={pair} world={world} t={t} w={w} compact />
              </li>
            ))}
          </ul>
        </section>
      }
    >
      {children}
    </PickBoard>
  );
}

/** The squares two by two, a pair at a time. */
function pairSquares(answers: string[], moves: string[]): string {
  const squares = Array.from(pickSquares(answers, moves));
  const pairs: string[] = [];
  for (let i = 0; i < squares.length; i += 2) pairs.push(squares.slice(i, i + 2).join(""));
  return pairs.join(" ");
}

export default defineSetBoard<Puzzle, string, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const answers = answersOf(puzzle);
    return shareLines(definition.title, day, pickScore(answers, moves).points, pairSquares(answers, moves), url);
  },
});

