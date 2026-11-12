"use client";

import { useEffect, useRef } from "react";
import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ReviewRow } from "@/components/play/result-card";
import { WorldMap, useMapLabels, type MapRegion, type MapRoute } from "@/components/world-map";
import { COUNTRIES, countryById } from "@/lib/countries";
import { formatNumber, translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { SQUARE, headlineKey, shareLines } from "../engines/kit";
import { NamePicker, type Nameable } from "../engines/name-picker";
import { PASS } from "../engines/rules";
import { useBoardKeys, useReveal } from "../engines/reveal";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, {
  CONTINENT_NAMES,
  NAME_GUESSES,
  RANGES,
  RIVERS,
  STRIKES,
  countryMove,
  featureById,
  frameOf,
  legVerdict,
  nameMove,
  passesToEnd,
  walk,
  type Feature,
  type Kind,
  type Leg,
  type Move,
  type Puzzle,
} from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

const nameable = (feature: Feature): Nameable => ({ id: feature.id, name: feature.name, also: feature.also });
const POOLS: Record<Kind, Nameable[]> = { river: RIVERS.map(nameable), range: RANGES.map(nameable) };
const COUNTRY_POOL: Nameable[] = COUNTRIES.map((country) => ({ id: country.id, name: country.name, also: country.also }));

/** The colour of a country on the map; the first that applies wins when two legs share one. */
const TONE_ORDER = ["answer", "near", "off", "way"];

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, Move>) {
  const locale = useLocale();
  const shell = useShellT();
  const mapLabels = useMapLabels();
  const t = translator(MESSAGES, locale);
  const state = walk(puzzle, moves);
  const reveal = useReveal(state.done);
  const total = state.legs.length;
  // A leg just finished stays on screen until the player moves on.
  const showing = reveal.showing && state.done > 0;
  const summary = state.over && !showing;
  const index = showing ? state.done - 1 : Math.min(state.at, total - 1);
  const leg = state.legs[index];
  const feature = leg.feature;
  const name = feature.name[locale];
  const countryName = (iso: string) => countryById(iso)?.name[locale] ?? iso;
  const featureName = (id: string) => featureById(id)?.name[locale] ?? id;
  const kindOf = (kind: Kind) => t(kind === "river" ? "kindRiver" : "kindRange");
  const missedOf = (item: Leg) => item.feature.countries.filter((iso) => !item.found.includes(iso));
  const listOf = (ids: string[]) =>
    ids
      .map(countryName)
      .sort((a, b) => a.localeCompare(b, locale))
      .join(", ");

  // The field the player was typing in goes when a stage ends: the next stage's field takes the focus
  // (not on touch screens, where the keyboard would cover the map that is to be named).
  const mainRef = useRef<HTMLElement>(null);
  const typedRef = useRef(false);
  const stageKey = summary ? "summary" : showing ? `reveal:${index}` : `${index}:${leg.stage}`;
  useEffect(() => {
    const active = document.activeElement;
    if (!typedRef.current || (active && active !== document.body)) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    mainRef.current?.querySelector<HTMLInputElement>(".picker-input")?.focus({ preventScroll: true });
  }, [stageKey]);
  const submit = (move: Move) => {
    typedRef.current = true;
    onMove(move);
  };

  useBoardKeys((key) => {
    if (key !== "Enter" && key !== "n" && key !== "N") return false;
    reveal.next();
    return true;
  }, showing);

  // ── The map ──
  const mapLegs = summary ? state.legs : [leg];
  const tones = new Map<string, string>();
  const paint = (iso: string, tone: string) => {
    for (const shape of countryById(iso)?.shapes ?? []) {
      const old = tones.get(shape);
      if (!old || TONE_ORDER.indexOf(tone) < TONE_ORDER.indexOf(old)) tones.set(shape, tone);
    }
  };
  for (const item of mapLegs) {
    item.found.forEach((iso) => paint(iso, "answer"));
    item.near.forEach((iso) => paint(iso, "near"));
    item.wrong.forEach((iso) => paint(iso, "off"));
    if (item.stage === "done") missedOf(item).forEach((iso) => paint(iso, "way"));
  }
  const regions: MapRegion[] = [...tones].map(([shape, tone]) => ({ shape, tone }));
  const routes: MapRoute[] = mapLegs.flatMap((item) =>
    item.feature.lines.map((line, i) => ({
      id: `${item.feature.id}:${i}`,
      kind: "route" as const,
      draw: true,
      points: line.map(([lon, lat]) => ({ lat, lon })),
    })),
  );
  const focus = mapLegs.flatMap((item) => frameOf(item.feature));
  const map = <WorldMap markers={[]} routes={routes} regions={regions} focus={focus} labels={mapLabels} ariaLabel={t("mapAria")} />;

  // ── The HUD ──
  const pips: Pip[] = state.legs.map((item, i) =>
    item.stage === "done" ? legVerdict(item) : i === state.at ? "current" : "todo",
  );
  const hud = (
    <Hud
      step={{ n: Math.min(state.at + 1, total), total, kind: "round" }}
      pips={pips}
      stats={[{ icon: "star", label: shell("score"), value: formatNumber(state.points, locale) }]}
      onGiveUp={() => {
        reveal.skip(total - state.done);
        onMoves(passesToEnd(state));
      }}
      over={state.over}
    />
  );

  // ── The result ──
  if (summary) {
    const named = state.legs.filter((item) => item.named).length;
    const found = state.legs.reduce((sum, item) => sum + item.found.length, 0);
    const all = state.legs.reduce((sum, item) => sum + item.feature.countries.length, 0);
    const review: ReviewRow[] = state.legs.map((item, i) => {
      const missed = missedOf(item);
      const guessed = item.named
        ? item.feature.name[locale]
        : item.guesses.length
          ? featureName(item.guesses.at(-1)!)
          : shell("gaveUp");
      return {
        id: item.feature.id,
        label: t("legLabel", { kind: kindOf(item.feature.kind), n: i + 1 }),
        verdict: legVerdict(item),
        yours: t("yours", { name: guessed, n: item.found.length, total: item.feature.countries.length }),
        right: missed.length ? `${item.feature.name[locale]} · ${t("missed", { list: listOf(missed) })}` : item.feature.name[locale],
        value: `+${item.points}`,
      };
    });
    const names = state.legs.map((item) => item.feature.name[locale]).join(" · ");
    return (
      <main className="game" data-game={definition.slug} data-summary="">
        {hud}
        <aside className="dossier dossier-plain">
          <div className="dossier-text">
            <p className="eyebrow">{label}</p>
            <h1 className="dossier-name">{names}</h1>
            <p className="dossier-description">{t("lead")}</p>
          </div>
        </aside>
        <section className="stage">
          <div className="summary">
            <ResultCard
              label={label}
              headline={shell(headlineKey(state.points))}
              answer={names}
              points={state.points}
              stats={[
                { label: t("statNames"), value: `${named}/${total}`, tone: named === total ? "hit" : named ? undefined : "miss" },
                { label: t("statCountries"), value: `${found}/${all}`, tone: found === all ? "hit" : undefined },
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

  const eyebrow = t("eyebrow", { n: index + 1, total, kind: kindOf(feature.kind) });
  let stage: React.ReactNode;

  if (showing) {
    // ── A leg just finished: its answer, before the next one ──
    const missed = missedOf(leg);
    stage = (
      <>
        <Plaque eyebrow={eyebrow} text={`*${name}*`} />
        <div className="pick-verdict action-bar rr-reveal" role="status" data-tone={legVerdict(leg) === "hit" ? "on" : "off"}>
          <div className="pick-verdict-text">
            {feature.lengthKm && <p>{t("lengthKm", { km: formatNumber(feature.lengthKm, locale) })}</p>}
            <p>
              {leg.named ? t("revealNamed", { n: leg.guesses.length }) : t("revealNotNamed")} ·{" "}
              {missed.length ? t("revealCountries", { n: leg.found.length, total: feature.countries.length }) : t("allCountries")} ·{" "}
              <b>+{leg.points}</b>
            </p>
            {missed.length > 0 && <p className="rr-missed">{t("missed", { list: listOf(missed) })}</p>}
          </div>
          <button type="button" className="button" onClick={reveal.next} autoFocus>
            {state.over ? shell("seeResult") : t("next")}
          </button>
        </div>
      </>
    );
  } else if (leg.stage === "name") {
    // ── Name it ──
    const misses = leg.guesses.length;
    const last = leg.guesses.at(-1);
    const left = NAME_GUESSES - misses;
    const hints = [
      misses >= 1 && t("hintContinent", { continent: CONTINENT_NAMES[feature.continent][locale] }),
      misses >= 2 && t("hintLetter", { letter: name.charAt(0).toUpperCase() }),
    ].filter((hint): hint is string => !!hint);
    stage = (
      <>
        <Plaque
          eyebrow={eyebrow}
          text={t(feature.kind === "river" ? "promptRiver" : "promptRange")}
          tone={last ? "off" : undefined}
          status={
            last ? (
              <>
                {t("notIt", { name: featureName(last) })} · {left === 1 ? t("lastGuess") : t("guessesLeft", { n: left })}
              </>
            ) : undefined
          }
        />
        {hints.length > 0 && (
          <ul className="rr-hints">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}
        <NamePicker
          key={`name:${feature.id}`}
          pool={POOLS[feature.kind]}
          locale={locale}
          taken={new Set(leg.guesses)}
          onSubmit={(id) => submit(nameMove(id))}
          labels={{
            placeholder: t(feature.kind === "river" ? "placeholderRiver" : "placeholderRange"),
            search: t("searchFeatures"),
            submit: shell("guess"),
            noMatch: t("noMatchFeature"),
          }}
        >
          <button type="button" className="button button-secondary" onClick={() => onMove(PASS)}>
            {t("dontKnow")}
          </button>
        </NamePicker>
      </>
    );
  } else {
    // ── Name the countries ──
    const last = leg.log.at(-1);
    const strikesLeft = STRIKES - leg.wrong.length;
    const opening = leg.named ? t("namedIt", { name }) : t("itWas", { name });
    const verdictText = !last
      ? opening
      : last.verdict === "hit"
        ? t("countryRight", { country: countryName(last.iso) })
        : last.verdict === "near"
          ? t("countryNear", { country: countryName(last.iso) })
          : t("countryWrong", { country: countryName(last.iso) });
    const tone = !last ? (leg.named ? "on" : "off") : last.verdict === "hit" ? "on" : last.verdict === "near" ? "near" : "off";
    stage = (
      <>
        <Plaque
          eyebrow={`${index + 1}/${total} · ${name}`}
          text={t(feature.kind === "river" ? "promptCountriesRiver" : "promptCountriesRange")}
          tone={tone}
          status={
            <>
              {verdictText} · {t("foundOf", { n: leg.found.length, total: feature.countries.length })} ·{" "}
              {strikesLeft === 1 ? t("lastStrike") : t("strikesLeft", { n: strikesLeft })}
            </>
          }
        />
        <NamePicker
          key={`countries:${feature.id}`}
          pool={COUNTRY_POOL}
          locale={locale}
          taken={new Set(leg.log.map((entry) => entry.iso))}
          onSubmit={(iso) => submit(countryMove(iso))}
          labels={{
            placeholder: t("placeholderCountry"),
            search: t("searchCountries"),
            submit: shell("guess"),
            noMatch: t("noMatchCountry"),
          }}
        >
          <button type="button" className="button button-secondary" onClick={() => onMove(PASS)}>
            {t("done")}
          </button>
        </NamePicker>
        {leg.log.length > 0 && (
          <ul className="rr-chips" aria-label={t("foundOf", { n: leg.found.length, total: feature.countries.length })}>
            {leg.log.map((entry) => (
              <li key={entry.iso} data-state={entry.verdict}>
                {countryName(entry.iso)}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <main ref={mainRef} className="game" data-game={definition.slug}>
      {hud}
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className="dossier-lead">{t("lead")}</p>
          <ol className="rr-legs">
            {state.legs.map((item, i) => (
              <li key={item.feature.id} data-state={i < state.done ? legVerdict(item) : i === index ? "current" : "todo"}>
                <span>{kindOf(item.feature.kind)}</span>
                <b>{i < state.done || (i === index && leg.stage !== "name") ? item.feature.name[locale] : "?"}</b>
                {i < state.done && <small>+{item.points}</small>}
              </li>
            ))}
          </ol>
        </div>
      </aside>
      <section className="stage">
        {stage}
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
  share({ day, puzzle, moves, url }) {
    const state = walk(puzzle, moves);
    const squares = state.legs
      .filter((leg) => leg.stage === "done")
      .map((leg) => SQUARE[legVerdict(leg)])
      .join("");
    return shareLines(definition.title, day, state.points, squares, url);
  },
});
