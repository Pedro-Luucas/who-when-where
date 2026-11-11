"use client";

import { useState } from "react";
import { useGameT } from "./messages";
import type { Person } from "./people";
import { Dossier } from "./dossier";
import { PlaceRound } from "./place-round";
import { ROUNDS, type Guess, type PlaceGuess, type YearGuess } from "./rules";
import { Summary } from "./summary";
import { YearRound } from "./year-round";

type BoardProps = {
  person: Person;
  guesses: Guess[];
  onGuess: (guess: Guess) => void;
  /** Latest year the dials allow (the current year). */
  maxYear: number;
  /** The line above the name: "No. 12 — Today's mind", "Stage 3 of 8 — Who When Where". */
  label: string;
  /** What follows the score once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

/** One Who When Where puzzle. The guesses live with whoever renders it. */
export function WhoWhenWhereBoard({ person, guesses, onGuess, maxYear, label, children }: BoardProps) {
  const { t } = useGameT();
  // True between locking a guess and pressing "next": the answer is on screen.
  const [revealing, setRevealing] = useState(false);

  const finished = guesses.length >= ROUNDS.length;
  const showSummary = finished && !revealing;
  const roundIndex = revealing ? guesses.length - 1 : Math.min(guesses.length, ROUNDS.length - 1);
  const round = ROUNDS[roundIndex];
  const locked = revealing ? guesses[roundIndex] : null;

  function lock(guess: Guess) {
    onGuess(guess);
    setRevealing(true);
  }

  const nextLabel = finished ? t("seeResults") : t("next");
  const proceed = () => setRevealing(false);

  return (
    <main className="game" data-summary={showSummary ? "" : undefined}>
      <Dossier
        person={person}
        label={label}
        guesses={guesses}
        current={showSummary ? null : roundIndex}
        revealAll={showSummary}
      />

      <section className="stage">
        {showSummary ? (
          <Summary person={person} guesses={guesses}>
            {children}
          </Summary>
        ) : round.kind === "place" ? (
          <PlaceRound
            key={round.id}
            person={person}
            round={round}
            locked={locked as PlaceGuess | null}
            onLock={lock}
            onNext={proceed}
            nextLabel={nextLabel}
          />
        ) : (
          <YearRound
            key={round.id}
            person={person}
            round={round}
            maxYear={maxYear}
            locked={locked as YearGuess | null}
            onLock={lock}
            onNext={proceed}
            nextLabel={nextLabel}
          />
        )}
      </section>
    </main>
  );
}
