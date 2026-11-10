"use client";

import { useState } from "react";
import { YearDial } from "@/components/year-dial";
import { useGameT } from "./messages";
import type { Person } from "./people";
import { Question, ScoreStamp } from "./round-parts";
import { gradeYear, type Round, type YearGuess } from "./rules";

type Props = {
  person: Person;
  round: Round;
  /** Latest year the dial allows (the current year). */
  maxYear: number;
  locked: YearGuess | null;
  onLock: (guess: YearGuess) => void;
  onNext: () => void;
  nextLabel: string;
};

const BIRTH_DIAL_START = 1700;

export function YearRound({ person, round, maxYear, locked, onLock, onNext, nextLabel }: Props) {
  const { t } = useGameT();
  // The birth year has been revealed by the time the death year is asked, so
  // that dial starts there and can't go earlier.
  const isDeath = round.event === "death";
  const min = isDeath ? person.birth.year : 1;
  const start = isDeath ? person.birth.year : BIRTH_DIAL_START;
  const [year, setYear] = useState(start);

  const answer = person[round.event].year;

  return (
    <>
      <Question person={person} round={round} />

      {locked ? (
        <YearComparison guess={locked.year} answer={answer} event={round.event} />
      ) : (
        <div className="dial-panel">
          <YearDial initial={start} min={min} max={maxYear} onChange={setYear} label={t("yearLabel")} />
        </div>
      )}

      {locked ? (
        <div className="verdict" role="status">
          <ScoreStamp score={locked.score} />
          <div className="verdict-text">
            <p className="verdict-headline">
              {locked.diff === 0
                ? t("exactYear")
                : locked.diff === 1
                  ? t("yearOff")
                  : t("yearsOff", { n: locked.diff })}
            </p>
            <p className="verdict-answer">
              {t(round.event === "birth" ? "born" : "died")} {answer}
            </p>
          </div>
          <button type="button" className="button" onClick={onNext} autoFocus>
            {nextLabel}
          </button>
        </div>
      ) : (
        <div className="controls">
          <p className="hint">{t("yearHint")}</p>
          <button type="button" className="button" onClick={() => onLock(gradeYear(person, round, year))}>
            {t("lockIn")}
          </button>
        </div>
      )}
    </>
  );
}

/** The guess and the answer pinned on one stretch of timeline. */
function YearComparison({
  guess,
  answer,
  event,
}: {
  guess: number;
  answer: number;
  event: "birth" | "death";
}) {
  const { t } = useGameT();
  const low = Math.min(guess, answer);
  const high = Math.max(guess, answer);
  const pad = Math.max(4, (high - low) * 0.35);
  const from = low - pad;
  const span = high + pad - from;
  const at = (year: number) => `${(((year - from) / span) * 100).toFixed(2)}%`;
  const exact = guess === answer;

  return (
    <div className="timeline" data-exact={exact ? "" : undefined}>
      <div className="timeline-track">
        {!exact && (
          <span
            className="timeline-gap"
            style={{ left: at(low), width: `${(((high - low) / span) * 100).toFixed(2)}%` }}
          />
        )}
        {!exact && (
          <span className="timeline-flag timeline-flag-guess" style={{ left: at(guess) }}>
            <small>{t("yourGuess")}</small>
            <strong>{guess}</strong>
          </span>
        )}
        <span className="timeline-flag timeline-flag-answer" style={{ left: at(answer) }}>
          <small>{t(event === "birth" ? "born" : "died")}</small>
          <strong>{answer}</strong>
        </span>
      </div>
    </div>
  );
}
