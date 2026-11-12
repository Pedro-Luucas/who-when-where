"use client";

import { translator, useLocale } from "@/lib/i18n";
import { notableById, type Notable } from "@/lib/notables";
import { SQUARE, shareLines } from "../engines/kit";
import { LadderBoard, type GuessReading } from "../engines/ladder";
import { lifeYears } from "../engines/parts";
import { PASS, ladderScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { MAX_GUESSES, NAMEABLE, cluesOf } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

/** Clues on show after `used` guesses out of `max`: fewer guesses start further up the ladder. */
const cluesShown = (used: number, max: number, over: boolean) =>
  over ? MAX_GUESSES : Math.min(MAX_GUESSES, used + 1 + (MAX_GUESSES - max));

function Board({ puzzle: person, moves, onMove, onMoves, tries = MAX_GUESSES, label, children }: BoardProps<Notable, string>) {
  const locale = useLocale();
  const t = translator(MESSAGES, locale);
  const score = ladderScore(person.id, moves, tries);
  const years = lifeYears(person.born.year, person.died.year, locale);
  const clues = cluesOf(person, locale, years);
  const shown = cluesShown(moves.length, tries, score.over);

  function read(id: string): GuessReading {
    if (id === person.id) return { verdict: "hit" };
    const guess = notableById(id);
    if (!guess) return { verdict: "miss" };
    const diff = guess.born.year - person.born.year;
    const when =
      diff === 0 ? t("bornSame") : diff < 0 ? t("bornEarlier", { n: -diff }) : t("bornLater", { n: diff });
    const sameField = guess.field.en === person.field.en;
    return {
      verdict: Math.abs(diff) <= 50 || sameField ? "near" : "miss",
      hint: sameField ? `${when} · ${t("sameField")}` : when,
    };
  }

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
      lead={t("lead")}
      eyebrow={t("eyebrow")}
      prompt={t("prompt")}
      subject={
        <ol className="clue-ladder" aria-live="polite">
          {clues.map((clue, i) =>
            i < shown ? (
              <li key={clue.key}>
                <span>
                  <small>{t(`clue_${clue.key}`)}</small>
                  <b>{clue.text}</b>
                </span>
              </li>
            ) : (
              <li key={clue.key} data-locked="">
                <span>
                  <small>{t(`clue_${clue.key}`)}</small>
                  <b>{t("clueLocked")}</b>
                </span>
              </li>
            ),
          )}
        </ol>
      }
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

export default defineSetBoard<Notable, string, MessageKey>(definition, {
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
