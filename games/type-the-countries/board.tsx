"use client";

import { useEffect, useState } from "react";
import { Hud } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ReviewRow } from "@/components/play/result-card";
import { WorldMap, useMapLabels, type MapRegion } from "@/components/world-map";
import { REGION_NAMES, regionOf, type Region } from "@/lib/geo-data";
import { translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, shareLines } from "../engines/kit";
import { exactName, fold } from "../engines/name-picker";
import { VIEWS, regionsOf } from "../engines/regions";
import { PASS } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { scoreOf, startMove, tally, type Move, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The seconds left on a clock that started at `started`. */
const leftAt = (puzzle: Puzzle, started: number, now: number) =>
  Math.max(0, puzzle.seconds - Math.floor((now - started) / 1000));

function Board({ puzzle, moves, onMove, label, children }: BoardProps<Puzzle, Move>) {
  const locale = useLocale();
  const shell = useShellT();
  const mapLabels = useMapLabels();
  const t = translator(MESSAGES, locale);
  const { started, found, over } = tally(puzzle, moves);
  const score = scoreOf(puzzle, moves);
  const total = puzzle.countries.length;
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const left = started === null ? puzzle.seconds : leftAt(puzzle, started, now);

  // The clock ticks while the run is on; when it runs out, the run ends.
  useEffect(() => {
    if (started === null || over) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [started, over]);

  useEffect(() => {
    if (started !== null && !over && left === 0) onMove(PASS);
  }, [started, over, left, onMove]);

  const foundSet = new Set(found);
  const open = puzzle.countries.filter((country) => !foundSet.has(country.id));
  const namesOf = (country: Puzzle["countries"][number]) => [country.name.en, country.name.pt, ...(country.also ?? [])];

  function accept(id: string) {
    onMove(id);
    setQuery("");
    const country = puzzle.countries.find((entry) => entry.id === id);
    if (country) setFlash(t("justFound", { country: country.name[locale] }));
  }

  /** The country the text names, and whether another one still starts with it ("Niger", "Nigeria"). */
  function read(text: string) {
    const typed = fold(text);
    const exact = typed ? exactName(text, open) : undefined;
    const longer =
      !!exact &&
      open.some((country) => country.id !== exact.id && namesOf(country).some((name) => fold(name).startsWith(typed)));
    return { exact, longer };
  }

  function type(text: string) {
    setQuery(text);
    const { exact, longer } = read(text);
    if (exact && !longer) accept(exact.id);
    else if (fold(text) && exactName(text, puzzle.countries.filter((country) => foundSet.has(country.id))))
      setFlash(t("already", { country: exactName(text, puzzle.countries)!.name[locale] }));
  }

  const pending = read(query);

  const regions: MapRegion[] = puzzle.countries.flatMap((country) =>
    foundSet.has(country.id)
      ? country.shapes.map((shape) => ({ shape, tone: "answer" }))
      : over
        ? country.shapes.map((shape) => ({ shape, tone: "off" }))
        : [],
  );

  const map = (
    <WorldMap markers={[]} regions={regions} focus={VIEWS[puzzle.set]} labels={mapLabels} ariaLabel={t("mapAria")} />
  );

  const hud = (
    <Hud
      stats={[
        { icon: "clock", label: shell("timeLeft"), value: clock(left) },
        { icon: "target", label: shell("statFoundCount"), value: t("found", { n: found.length, total }) },
      ]}
      onGiveUp={started === null ? undefined : () => onMove(PASS)}
      over={over}
    />
  );

  const eyebrow = t("eyebrow", { n: total, time: clock(puzzle.seconds) });

  if (over) {
    const review: ReviewRow[] = regionsOf(puzzle.set).map((region: Region) => {
      const inRegion = puzzle.countries.filter((country) => regionOf(country.id) === region);
      const named = inRegion.filter((country) => foundSet.has(country.id)).length;
      const missed = inRegion.filter((country) => !foundSet.has(country.id));
      return {
        id: region,
        label: REGION_NAMES[region][locale],
        verdict: named === inRegion.length ? "hit" : named >= inRegion.length / 2 ? "near" : named ? "miss" : "skip",
        yours: `${named}/${inRegion.length}`,
        right: missed.length
          ? missed
              .map((country) => country.name[locale])
              .sort((a, b) => a.localeCompare(b, locale))
              .join(", ")
          : undefined,
      };
    });
    return (
      <main className="game" data-game={definition.slug} data-summary="">
        {hud}
        <aside className="dossier dossier-plain">
          <div className="dossier-text">
            <p className="eyebrow">{label}</p>
            <p className="dossier-description">{t("lead")}</p>
          </div>
        </aside>
        <section className="stage">
          <div className="summary">
            <ResultCard
              label={label}
              headline={found.length === total ? t("allFound") : shell(headlineKey(score.points))}
              answer={t("answer", { n: found.length, total })}
              points={score.points}
              stats={[
                { label: shell("statFoundCount"), value: `${found.length}/${total}`, tone: found.length === total ? "hit" : undefined },
                { label: shell("timeLeft"), value: clock(started === null ? 0 : left) },
              ]}
              review={review}
            >
              {children}
            </ResultCard>
            <figure className="life">
              <figcaption>
                <span className="eyebrow">{shell("onTheMap")}</span>
              </figcaption>
              {map}
            </figure>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="game" data-game={definition.slug}>
      {hud}
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className="dossier-lead">{t("lead")}</p>
        </div>
      </aside>
      <section className="stage">
        <Plaque
          eyebrow={eyebrow}
          text={t("prompt")}
          tone={flash ? "on" : undefined}
          status={started === null ? undefined : (flash ?? t("found", { n: found.length, total }))}
        />
        {started === null ? (
          <div className="controls action-bar">
            <p className="hint">{t("startNote")}</p>
            <button type="button" className="button" onClick={() => onMove(startMove(Date.now()))} autoFocus>
              {t("start")}
            </button>
          </div>
        ) : (
          <form
            className="picker type-countries"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending.exact) accept(pending.exact.id);
            }}
          >
            <input
              className="picker-input"
              type="text"
              value={query}
              onChange={(event) => type(event.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("inputLabel")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
            />
            <p className="hint">
              {pending.exact && pending.longer ? <kbd>↵ {pending.exact.name[locale]}</kbd> : t("typeHint")}
            </p>
          </form>
        )}
        {map}
        {found.length > 0 && (
          <ul className="type-countries-found" aria-label={t("found", { n: found.length, total })}>
            {[...found].reverse().map((id) => {
              const country = puzzle.countries.find((entry) => entry.id === id);
              return country ? <li key={id}>{country.name[locale]}</li> : null;
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default defineSetBoard<Puzzle, Move, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const score = scoreOf(puzzle, moves);
    return shareLines(definition.title, day, score.points, `🌍 ${score.detail}`, url);
  },
});
