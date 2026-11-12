"use client";

import { useState } from "react";
import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ResultStat, type ReviewRow, type Verdict } from "@/components/play/result-card";
import { WorldMap, useMapLabels, type MapArc, type MapMarker, type MapRegion } from "@/components/world-map";
import { formatNumber, useLocale } from "@/lib/i18n";
import { useFinePointer } from "@/lib/pointer";
import type { LatLon } from "@/lib/geo";
import { useShellT } from "@/lib/shell-messages";
import { useBoardKeys, useReveal } from "./reveal";
import { PASS, roundsScore, walkRounds, type Judged, type RoundWalk } from "./rules";

// The Pin engine: rounds on the map. Each round names something (a city, a
// country); the player taps the map and locks the choice in. A round can
// allow a few tries (tap the country: wrong ones are named and coloured) or
// one (drop a pin: scored by the distance). Who When Where's place rounds and
// Dig Site were the first games of this kind.
//
// A game supplies the rounds, how a try is judged (pure: games/engines/
// rules.ts walkRounds, which its data module scores with too), how a spot on
// the map becomes a move (the pin itself, or the country under it), and how
// a try looks on the map.

export type PinRound = {
  key: string;
  eyebrow: string;
  /** The question; words in *asterisks* are lit. */
  prompt: string;
  /** Where the answer is. */
  target: LatLon;
  /** The answer in words, once the round is over: "Lagos, Nigeria". */
  answer: string;
  /** Countries coloured in once the round is over (the answer's own shape). */
  answerRegions?: MapRegion[];
  /** What the map frames while the round is played; the whole world when left out. */
  view?: LatLon[];
  /** Shown between the prompt and the map while the round is played and on its reveal (a photo). */
  media?: React.ReactNode;
};

/** How a try (or the choice about to be locked in) shows: on the map, and in a few words. */
export type PinTry = { marker: MapMarker; regions?: MapRegion[]; text: string };

type Props<Move> = {
  game: string;
  rounds: PinRound[];
  moves: Move[];
  onMove: (move: Move) => void;
  onMoves: (moves: Move[]) => void;
  /** Tries a round allows. */
  tries: number;
  judge: (round: number, move: Move, attempt: number) => Judged;
  /** The move a spot on the map makes, or null when it makes none (the sea, when a country is asked). */
  resolve: (point: LatLon) => Promise<Move | null>;
  /** How a try looks; `judged` is null for a choice not yet locked in. */
  describe: (round: number, move: Move, judged: Judged | null) => PinTry;
  /** A finished round in a few words, for its verdict and the review ("312 km off"). */
  summary: (round: number, walk: RoundWalk<Move>) => string;
  /** Said when a tap makes no move. */
  nothingHere: string;
  label: string;
  lead: string;
  /** The result's verdict, from the points. */
  headline: (points: number) => React.ReactNode;
  stats?: ResultStat[];
  after?: React.ReactNode;
  children?: React.ReactNode;
};

const verdictOf = (walk: RoundWalk<unknown>): Verdict =>
  walk.tries.length === 0 ? "skip" : walk.share >= 0.85 ? "hit" : walk.share >= 0.4 ? "near" : "miss";

export function PinBoard<Move>({
  game,
  rounds,
  moves,
  onMove,
  onMoves,
  tries,
  judge,
  resolve,
  describe,
  summary,
  nothingHere,
  label,
  lead,
  headline,
  stats = [],
  after,
  children,
}: Props<Move>) {
  const shell = useShellT();
  const locale = useLocale();
  const mapLabels = useMapLabels();
  const mouse = useFinePointer();
  const walk = walkRounds(rounds.length, moves, tries, judge);
  const reveal = useReveal(walk.done);
  const score = roundsScore(walk.shares, rounds.length, walk.over);
  // The round whose answer is on screen, or the one being played.
  const showing = reveal.showing ? walk.done - 1 : null;
  const index = Math.min(showing ?? walk.done, rounds.length - 1);
  const round = rounds[index];
  const progress = walk.rounds[index] as RoundWalk<Move> | undefined;
  const finished = walk.over && showing === null;

  // The spot chosen and not yet locked in, with the move it makes.
  const [pending, setPending] = useState<{ round: number; move: Move | null; empty: boolean } | null>(null);
  const chosen = pending && pending.round === index && showing === null ? pending : null;

  async function pick(point: LatLon) {
    const at = index;
    setPending({ round: at, move: null, empty: false });
    try {
      const move = await resolve(point);
      setPending((current) => (current && current.round === at ? { round: at, move, empty: move === null } : current));
    } catch {
      setPending(null);
    }
  }

  function lock() {
    if (!chosen || chosen.move === null) return;
    onMove(chosen.move);
    setPending(null);
  }

  function giveUp() {
    const left = rounds.length - walk.done;
    if (left <= 0) return;
    reveal.skip(left);
    setPending(null);
    onMoves(Array.from({ length: left }, () => PASS as Move));
  }

  useBoardKeys((key) => {
    if (showing !== null && (key === "Enter" || key === "ArrowRight" || key === " ")) {
      reveal.next();
      return true;
    }
    // A pin on the map: Enter locks it in.
    if (showing === null && key === "Enter" && chosen && chosen.move !== null) {
      lock();
      return true;
    }
    return false;
  }, !walk.over);

  const pips: Pip[] = rounds.map((_, i) => {
    const entry = walk.rounds[i];
    if (entry?.done) return verdictOf(entry as RoundWalk<unknown>);
    return i === walk.done && !walk.over ? "current" : "todo";
  });
  const hud = (
    <Hud
      step={{ n: finished ? rounds.length : index + 1, total: rounds.length, kind: "round" }}
      pips={pips}
      stats={[{ icon: "target", label: shell("score"), value: formatNumber(score.points, locale) }]}
      onGiveUp={giveUp}
      over={walk.over}
    />
  );

  if (finished) {
    const review: ReviewRow[] = rounds.map((entry, i) => {
      const done = walk.rounds[i];
      const last = done?.tries.at(-1);
      return {
        id: entry.key,
        label: entry.answer,
        verdict: done ? verdictOf(done as RoundWalk<unknown>) : "skip",
        yours: last ? describe(i, last.move, last.judged).text : shell("gaveUp"),
        value: done && done.tries.length ? summary(i, done) : undefined,
      };
    });
    const markers: MapMarker[] = [];
    const arcs: MapArc[] = [];
    rounds.forEach((entry, i) => {
      const last = walk.rounds[i]?.tries.at(-1);
      markers.push({ ...entry.target, kind: "answer", badge: String(i + 1), label: entry.answer.split(",")[0] });
      if (last) {
        const shown = describe(i, last.move, last.judged).marker;
        if (!last.judged.hit) {
          markers.push({ lat: shown.lat, lon: shown.lon, kind: "guess", badge: String(i + 1) });
          arcs.push({ from: shown, to: entry.target, kind: "miss" });
        }
      }
    });
    const hits = walk.rounds.filter((entry) => verdictOf(entry as RoundWalk<unknown>) === "hit").length;

    return (
      <main className="game" data-game={game} data-engine="pin" data-summary="">
        {hud}
        <aside className="dossier dossier-plain">
          <div className="dossier-text">
            <p className="eyebrow">{label}</p>
            <p className="dossier-description">{lead}</p>
          </div>
        </aside>
        <section className="stage">
          <div className="summary">
            <ResultCard
              label={label}
              headline={headline(score.points)}
              answer={shell("pinRounds", { n: rounds.length })}
              points={score.points}
              stats={([{ label: shell("statSpotOn"), value: `${hits}/${rounds.length}`, tone: hits === rounds.length ? "hit" : undefined }, ...stats] satisfies ResultStat[]).slice(0, 4)}
              review={review}
            >
              {children}
            </ResultCard>
            <figure className="life">
              <figcaption>
                <span className="eyebrow">{shell("onTheMap")}</span>
              </figcaption>
              <WorldMap
                markers={markers}
                arcs={arcs}
                focus={[...markers]}
                labels={mapLabels}
                ariaLabel={shell("onTheMap")}
              />
            </figure>
            {after}
          </div>
        </section>
      </main>
    );
  }

  const triesMade = progress?.tries ?? [];
  const lastTry = triesMade.at(-1);
  const roundOver = showing !== null;
  const markers: MapMarker[] = [];
  const regions: MapRegion[] = [];
  const arcs: MapArc[] = [];
  triesMade.forEach((entry) => {
    const shown = describe(index, entry.move, entry.judged);
    markers.push(shown.marker);
    regions.push(...(shown.regions ?? []));
  });
  if (roundOver) {
    regions.push(...(round.answerRegions ?? []));
    markers.push({ ...round.target, kind: "answer", label: round.answer });
    if (lastTry && !lastTry.judged.hit) arcs.push({ from: describe(index, lastTry.move, lastTry.judged).marker, to: round.target, kind: "miss" });
  } else if (chosen?.move != null) {
    const shown = describe(index, chosen.move, null);
    markers.push(shown.marker);
    regions.push(...(shown.regions ?? []));
  }
  const focus = roundOver ? [round.target, ...markers] : round.view;
  const left = tries - triesMade.length;

  return (
    <main className="game" data-game={game} data-engine="pin">
      {hud}
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className="dossier-lead">{lead}</p>
        </div>
      </aside>

      <section className="stage" key={round.key}>
        <Plaque
          eyebrow={round.eyebrow}
          text={round.prompt}
          tone={
            roundOver && progress
              ? { hit: "on", near: "near", miss: "off", skip: "off" }[verdictOf(progress as RoundWalk<unknown>)]
              : lastTry
                ? "off"
                : undefined
          }
          status={
            roundOver && progress ? (
              <>
                <b>{summary(index, progress)}</b> · {round.answer}
              </>
            ) : lastTry ? (
              <>
                <b>{describe(index, lastTry.move, lastTry.judged).text}</b> ·{" "}
                {left === 1 ? shell("pinLastTry") : shell("pinTriesLeft", { n: left })}
              </>
            ) : undefined
          }
        />

        {round.media}

        <WorldMap
          markers={markers}
          regions={regions}
          arcs={arcs}
          onPick={roundOver ? undefined : pick}
          focus={focus}
          labels={mapLabels}
          ariaLabel={round.prompt.replace(/\*/g, "")}
        >
          {roundOver ? null : chosen?.empty ? nothingHere : chosen?.move != null ? describe(index, chosen.move, null).text : shell(mouse ? "pinHintMouse" : "pinHint")}
        </WorldMap>

        {roundOver ? (
          <div className="controls action-bar" role="status">
            <p className="hint">{round.answer}</p>
            <button type="button" className="button" onClick={reveal.next} autoFocus>
              {walk.over ? shell("seeResult") : shell("nextRound")}
            </button>
          </div>
        ) : (
          <div className="controls action-bar">
            <p className="hint">{shell(mouse ? "pinZoomMouse" : "pinZoom")}</p>
            <button type="button" className="button" disabled={chosen?.move == null} onClick={lock}>
              {shell("lockIn")}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
