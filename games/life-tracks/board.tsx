"use client";

import { WorldMap, useMapLabels, type MapMarker, type MapRoute } from "@/components/world-map";
import { formatYear, translator, useLocale } from "@/lib/i18n";
import { notableById } from "@/lib/notables";
import { SQUARE, shareLines } from "../engines/kit";
import { LadderBoard, type GuessReading } from "../engines/ladder";
import { lifeYears } from "../engines/parts";
import { PASS, ladderScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { MAX_GUESSES, NAMEABLE, centuryOf, fieldShown, stopsShown, type Track } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

// Life Tracks: the Name engine's ladder, with a life drawn as a route. The
// stops on show are numbered on the map and listed in the brief; every miss
// draws the next leg, and the last guess shows the whole route and the field.

function Board({ puzzle: track, moves, onMove, onMoves, tries = MAX_GUESSES, label, children }: BoardProps<Track, string>) {
  const locale = useLocale();
  const t = translator(MESSAGES, locale);
  const mapLabels = useMapLabels();
  const { person, stops } = track;
  const score = ladderScore(person.id, moves, tries);
  const over = score.over;
  const shown = stopsShown(track, moves.length, tries, over);
  const visible = stops.slice(0, shown);
  const hidden = stops.length - shown;
  const withField = fieldShown(moves.length, tries, over);

  function read(id: string): GuessReading {
    if (id === person.id) return { verdict: "hit" };
    const guess = notableById(id);
    if (!guess) return { verdict: "miss" };
    const diff = guess.born.year - person.born.year;
    const when =
      diff === 0 ? t("bornSame") : diff < 0 ? t("bornEarlier", { n: -diff }) : t("bornLater", { n: diff });
    const sameCentury = centuryOf(guess.born.year) === centuryOf(person.born.year);
    const sameField = guess.field.en === person.field.en;
    const extras = [sameCentury && diff !== 0 ? t("sameCentury") : null, sameField ? t("sameField") : null].filter(Boolean);
    return {
      verdict: sameCentury || sameField ? "near" : "miss",
      hint: [when, ...extras].join(" · "),
    };
  }

  // The route so far: the legs already seen drawn at once, the newest one animated.
  const routes: MapRoute[] = [];
  const settled = Math.max(1, shown - 1);
  if (settled > 1) routes.push({ kind: "route", points: stops.slice(0, settled) });
  if (shown > settled) {
    routes.push({ kind: "route", draw: true, id: `leg-${shown}`, points: stops.slice(settled - 1, shown) });
  }
  const markers: MapMarker[] = visible.map((stop, i) => ({
    lat: stop.lat,
    lon: stop.lon,
    kind: !over && i === shown - 1 ? "answer" : "stop",
    badge: String(i + 1),
    label: over || i === shown - 1 ? stop.name[locale] : undefined,
    labelBelow: i % 2 === 1,
  }));

  const media = (
    <figure className="life life-tracks-map">
      <figcaption>
        <span className="eyebrow">{t("route")}</span>
        {hidden > 0 && (
          <span className="life-tracks-more">{hidden === 1 ? t("oneMoreStop") : t("moreStops", { n: hidden })}</span>
        )}
      </figcaption>
      <WorldMap markers={markers} routes={routes} focus={visible} labels={mapLabels} ariaLabel={t("mapAria")} />
    </figure>
  );

  const subject = (
    <div className="life-tracks-brief">
      <ol className="life-tracks-stops" aria-live="polite">
        {visible.map((stop, i) => (
          <li key={i} data-kind={stop.kind}>
            <span className="life-tracks-n">{i + 1}</span>
            <span>
              <small>
                {t(`kind_${stop.kind}`)}
                {stop.year !== null && <> · {formatYear(stop.year, locale)}</>}
              </small>
              <b>{stop.name[locale]}</b>
              {over && stop.at && <em>{stop.at[locale]}</em>}
            </span>
          </li>
        ))}
        {hidden > 0 && (
          <li data-locked="">
            <span className="life-tracks-n">…</span>
            <span>
              <b>{hidden === 1 ? t("oneMoreStop") : t("moreStops", { n: hidden })}</b>
            </span>
          </li>
        )}
      </ol>
      <p className="life-tracks-field" data-locked={withField ? undefined : ""}>
        <small>{t("field")}</small>
        <b>{withField ? person.field[locale] : t("fieldLocked")}</b>
      </p>
    </div>
  );

  return (
    <LadderBoard
      game={definition.slug}
      answer={person.id}
      guesses={moves}
      onGuess={onMove}
      onGuesses={onMoves}
      max={tries}
      pool={NAMEABLE}
      locale={locale}
      label={label}
      lead={over ? `${lifeYears(person.born.year, person.died.year, locale)} · ${person.description[locale]}` : t("lead")}
      eyebrow={t("eyebrow")}
      prompt={t("prompt")}
      subject={subject}
      media={media}
      answerName={person.name[locale]}
      read={read}
      points={score.points}
      picker={{ placeholder: t("placeholder"), search: t("search"), noMatch: t("noMatch") }}
      after={
        <p className="bio-links">
          <a href={person.wiki[locale] ?? person.wiki.en} target="_blank" rel="noreferrer">
            {t("readMore")}
          </a>
        </p>
      }
    >
      {children}
    </LadderBoard>
  );
}

export default defineSetBoard<Track, string, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const id = puzzle.person.id;
    const squares = moves.map((move) => (move === id ? SQUARE.hit : move === PASS ? SQUARE.skip : SQUARE.miss)).join("");
    return shareLines(definition.title, day, ladderScore(id, moves, MAX_GUESSES).points, squares, url);
  },
});
