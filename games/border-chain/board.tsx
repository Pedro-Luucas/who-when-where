"use client";

import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ReviewRow, type Verdict } from "@/components/play/result-card";
import { WorldMap, useMapLabels, type MapMarker, type MapRegion } from "@/components/world-map";
import { COUNTRIES, cornersOf, countryById } from "@/lib/countries";
import { translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { SQUARE, shareLines } from "../engines/kit";
import { NamePicker } from "../engines/name-picker";
import { PASS } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { BACK, SPARE, scoreOf, shortestPath, walkOf, type Move, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

const NAMEABLE = COUNTRIES.map((country) => ({ id: country.id, name: country.name, also: country.also }));

const VERDICT: Record<"joined" | "miss" | "back" | "pass", Verdict> = { joined: "hit", miss: "miss", back: "skip", pass: "skip" };

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, Move>) {
  const locale = useLocale();
  const shell = useShellT();
  const mapLabels = useMapLabels();
  const t = translator(MESSAGES, locale);
  const walk = walkOf(puzzle, moves);
  const score = scoreOf(puzzle, moves);
  const budget = puzzle.shortest + SPARE;
  const nameOf = (id: string) => countryById(id)?.name[locale] ?? id;
  const at = walk.chain.at(-1)!;
  const best = shortestPath(puzzle.from.id, puzzle.to.id);

  // The map: the chain so far, the start and the target; once it is over, a shortest way too.
  const regions: MapRegion[] = [];
  const shown = new Set<string>();
  const paint = (id: string, tone: string) => {
    if (shown.has(id)) return;
    shown.add(id);
    regions.push(...(countryById(id)?.shapes ?? []).map((shape) => ({ shape, tone })));
  };
  paint(puzzle.from.id, "end");
  paint(puzzle.to.id, "end");
  walk.chain.forEach((id) => paint(id, "answer"));
  if (walk.over) best.forEach((id) => paint(id, "way"));
  const markers: MapMarker[] = [
    { lat: puzzle.from.lat, lon: puzzle.from.lon, kind: "stop", label: puzzle.from.name[locale] },
    { lat: puzzle.to.lat, lon: puzzle.to.lon, kind: "answer", label: puzzle.to.name[locale] },
  ];
  if (at !== puzzle.from.id && at !== puzzle.to.id) {
    const here = countryById(at);
    if (here) markers.push({ lat: here.lat, lon: here.lon, kind: "guess", label: here.name[locale] });
  }
  const focus = [...cornersOf(puzzle.from), ...cornersOf(puzzle.to), ...walk.chain.flatMap((id) => countryById(id) ?? [])];

  const pips: Pip[] = Array.from({ length: budget }, (_, i) => {
    const entry = walk.log[i];
    if (!entry) return i === walk.log.length && !walk.over ? "current" : "todo";
    return VERDICT[entry.result];
  });
  const hud = (
    <Hud
      step={{ n: Math.min(walk.used + 1, budget), total: budget, kind: "try" }}
      pips={pips}
      stats={[{ icon: "flag", label: shell("statSteps"), value: `${walk.chain.length - 1}/${puzzle.shortest}` }]}
      onGiveUp={() => onMove(PASS)}
      over={walk.over}
    />
  );
  const map = (
    <WorldMap markers={markers} regions={regions} focus={focus} labels={mapLabels} ariaLabel={t("mapAria")} />
  );
  const prompt = t("prompt", { from: puzzle.from.name[locale], to: puzzle.to.name[locale] });

  if (walk.over) {
    const review: ReviewRow[] = walk.log
      .filter((entry) => entry.result !== "pass")
      .map((entry, i) => ({
        id: `${i}-${entry.move}`,
        label: t("moveN", { n: i + 1 }),
        verdict: VERDICT[entry.result],
        yours: entry.move === BACK ? t("stepBack") : nameOf(entry.move),
        value: entry.result === "joined" ? t("resultJoined") : entry.result === "miss" ? t("resultMiss") : undefined,
      }));
    return (
      <main className="game" data-game={definition.slug} data-summary="">
        {hud}
        <aside className="dossier dossier-plain">
          <div className="dossier-text">
            <p className="eyebrow">{label}</p>
            <h1 className="dossier-name">{prompt.replace(/\*/g, "")}</h1>
            <p className="dossier-description">{t("lead")}</p>
          </div>
        </aside>
        <section className="stage">
          <div className="summary">
            <ResultCard
              label={label}
              headline={
                walk.reached ? (walk.used === puzzle.shortest ? t("perfect") : t("arrived", { n: walk.used })) : t("lost")
              }
              answer={`${t("aShortest")}: ${best.map(nameOf).join(" → ")}`}
              points={score.points}
              stats={[
                { label: shell("statSteps"), value: `${walk.used}/${puzzle.shortest}`, tone: walk.reached ? "hit" : "miss" },
                { label: shell("statFound"), value: shell(walk.reached ? "yes" : "no"), tone: walk.reached ? "hit" : "miss" },
              ]}
              review={review}
            >
              {children}
            </ResultCard>
            <figure className="life">
              <figcaption>
                <span className="eyebrow">
                  {t("yourChain")}: {walk.chain.map(nameOf).join(" → ")}
                </span>
              </figcaption>
              {map}
            </figure>
          </div>
        </section>
      </main>
    );
  }

  const last = walk.log.at(-1);
  const left = budget - walk.used;
  const lastText = !last
    ? t("now", { country: nameOf(at) })
    : last.result === "joined"
      ? `${t("joined", { country: nameOf(last.move) })} ${t("now", { country: nameOf(at) })}`
      : last.result === "back"
        ? t("back", { country: nameOf(at) })
        : walk.chain.includes(last.move)
          ? t("again", { country: nameOf(last.move) })
          : t("miss", { country: nameOf(last.move), at: nameOf(walk.chain.at(-1)!) });

  return (
    <main className="game" data-game={definition.slug}>
      {hud}
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className="dossier-lead">{t("lead")}</p>
          <ol className="chain-trail" aria-label={t("yourChain")}>
            {walk.chain.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
            <li data-target="">{puzzle.to.name[locale]}</li>
          </ol>
        </div>
      </aside>
      <section className="stage">
        <Plaque
          eyebrow={t("eyebrow", { n: puzzle.shortest })}
          text={prompt}
          tone={last?.result === "miss" ? "off" : last?.result === "joined" ? "on" : undefined}
          status={
            <>
              {lastText} · {left === 1 ? t("lastMove") : t("movesLeft", { n: left })}
            </>
          }
        />
        <NamePicker
          pool={NAMEABLE}
          locale={locale}
          taken={new Set(walk.chain)}
          onSubmit={onMove}
          labels={{ placeholder: t("placeholder"), search: t("search"), submit: t("go"), noMatch: t("noMatch") }}
        >
          <button
            type="button"
            className="button button-secondary"
            disabled={walk.chain.length < 2}
            onClick={() => onMoves([BACK])}
          >
            {t("undo")}
          </button>
        </NamePicker>
        {map}
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
  share({ day, puzzle, moves, locale, url }) {
    const walk = walkOf(puzzle, moves);
    const squares = walk.log
      .filter((entry) => entry.result !== "pass")
      .map((entry) => (entry.result === "joined" ? SQUARE.hit : entry.result === "miss" ? SQUARE.miss : SQUARE.skip))
      .join("");
    return shareLines(`${definition.title} ${puzzle.from.name[locale]} → ${puzzle.to.name[locale]}`, day, scoreOf(puzzle, moves).points, squares, url);
  },
});
