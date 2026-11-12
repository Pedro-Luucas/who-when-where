"use client";

import { countryById, type Country } from "@/lib/countries";
import { distanceKm } from "@/lib/geo";
import { REGION_NAMES, regionOf } from "@/lib/geo-data";
import { formatNumber, translator, useLocale } from "@/lib/i18n";
import { SQUARE, shareLines } from "../engines/kit";
import { LadderBoard, type GuessReading } from "../engines/ladder";
import { Flag } from "../engines/parts";
import { PASS, ladderScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { COLUMNS, MAX_GUESSES, NAMEABLE, ROWS, liftedAfter, tileOrder } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

function Board({ puzzle: country, moves, onMove, onMoves, tries = MAX_GUESSES, label, children }: BoardProps<Country, string>) {
  const locale = useLocale();
  const t = translator(MESSAGES, locale);
  const score = ladderScore(country.id, moves, tries);
  const lifted = new Set(tileOrder(country).slice(0, liftedAfter(moves.length, tries, score.over)));

  function read(id: string): GuessReading {
    if (id === country.id) return { verdict: "hit" };
    const guess = countryById(id);
    if (!guess) return { verdict: "miss" };
    const km = formatNumber(Math.round(distanceKm(guess, country) / 10) * 10, locale);
    const region = regionOf(guess.id);
    const same = region !== undefined && region === regionOf(country.id);
    return {
      verdict: same ? "near" : "miss",
      hint: same ? t("sameContinent", { km }) : t("elsewhere", { km, continent: region ? REGION_NAMES[region][locale] : "—" }),
    };
  }

  return (
    <LadderBoard
      game={definition.slug}
      answer={country.id}
      guesses={moves}
      onGuess={onMove}
      onGuesses={onMoves}
      max={tries}
      pool={NAMEABLE}
      locale={locale}
      label={label}
      lead={t("lead")}
      eyebrow={t("eyebrow")}
      prompt={t("prompt")}
      subject={
        <figure className="flag-peek" style={{ "--cols": COLUMNS, "--rows": ROWS } as React.CSSProperties}>
          <Flag id={country.id} alt={score.over ? t("flagOf", { country: country.name[locale] }) : t("hidden")} />
          <div className="flag-peek-tiles" aria-hidden="true">
            {Array.from({ length: COLUMNS * ROWS }, (_, i) => (
              <i key={i} data-open={lifted.has(i) ? "" : undefined} />
            ))}
          </div>
        </figure>
      }
      answerName={country.name[locale]}
      read={read}
      points={score.points}
      picker={{ placeholder: t("placeholder"), search: t("search"), noMatch: t("noMatch") }}
    >
      {children}
    </LadderBoard>
  );
}

export default defineSetBoard<Country, string, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const squares = moves.map((id) => (id === puzzle.id ? SQUARE.hit : id === PASS ? SQUARE.skip : SQUARE.miss)).join("");
    return shareLines(definition.title, day, ladderScore(puzzle.id, moves, MAX_GUESSES).points, squares, url);
  },
});
