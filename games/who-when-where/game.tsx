"use client";

import { useState } from "react";
import { Hud, type Pip } from "@/components/play/hud";
import { useShellT } from "@/lib/shell-messages";
import { useGameT } from "./messages";
import type { Person } from "./people";
import { Dossier } from "./dossier";
import { PlaceRound } from "./place-round";
import { ROUNDS, ROUND_MAX, totalScore, type Guess, type PlaceGuess, type YearGuess } from "./rules";
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
  const shell = useShellT();
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

  // One pip per round: how many of its 250 points it earned.
  const pips: Pip[] = ROUNDS.map((_, i) => {
    const guess = guesses[i];
    if (!guess) return i === roundIndex && !showSummary ? "current" : "todo";
    return guess.score >= ROUND_MAX * 0.8 ? "hit" : guess.score >= ROUND_MAX * 0.4 ? "near" : "miss";
  });

  return (
    <main className="game" data-game="who-when-where" data-summary={showSummary ? "" : undefined}>
      <Hud
        step={{ n: Math.min(roundIndex + 1, ROUNDS.length), total: ROUNDS.length, kind: "round" }}
        pips={pips}
        stats={[{ icon: "star", label: shell("score"), value: totalScore(guesses) }]}
        over={showSummary}
      />
      <Dossier
        person={person}
        label={label}
        guesses={guesses}
        current={showSummary ? null : roundIndex}
        revealAll={showSummary}
      />

      <section className="stage">
        {showSummary ? (
          <Summary person={person} guesses={guesses} label={label}>
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
