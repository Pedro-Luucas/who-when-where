"use client";

import { Suspense, use, useState } from "react";
import { browser } from "react-dom";
import { useDayNumber } from "@/lib/clock";
import { yearOfDay } from "@/lib/daily";
import { useGameT } from "./messages";
import { Panels } from "./panels";
import { personById, personForDay } from "./people";
import { Dossier } from "./dossier";
import { PlaceRound } from "./place-round";
import { ROUNDS, type Guess, type PlaceGuess, type YearGuess } from "./rules";
import { useSave } from "./store";
import { Summary } from "./summary";
import { YearRound } from "./year-round";

export function WhoWhenWhere() {
  return (
    <Suspense fallback={<GameSkeleton />}>
      <Today />
    </Suspense>
  );
}

function Today() {
  use(browser("The daily puzzle depends on the player's local date and saved progress."));
  const day = useDayNumber();
  // Keyed by day: at midnight the next puzzle starts from a clean slate.
  return <Play key={day} day={day} />;
}

function Play({ day }: { day: number }) {
  const [save, setSave] = useSave();
  const { t } = useGameT();
  // True between locking a guess and pressing "next": the answer is on screen.
  const [revealing, setRevealing] = useState(false);

  // A saved record names its person, so a roster change can't reassign it.
  const stored = save.days[day];
  const record = stored && personById(stored.personId) ? stored : undefined;
  const person = (record && personById(record.personId)) ?? personForDay(day);
  const guesses = record?.guesses ?? [];

  const finished = guesses.length >= ROUNDS.length;
  const showSummary = finished && !revealing;
  const roundIndex = revealing ? guesses.length - 1 : Math.min(guesses.length, ROUNDS.length - 1);
  const round = ROUNDS[roundIndex];
  const locked = revealing ? guesses[roundIndex] : null;

  function lock(guess: Guess) {
    setSave((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [day]: {
          personId: person.id,
          guesses: [...(previous.days[day]?.guesses ?? []), guess],
        },
      },
    }));
    setRevealing(true);
  }

  const nextLabel = finished ? t("seeResults") : t("next");
  const proceed = () => setRevealing(false);

  return (
    <main className="game" data-summary={showSummary ? "" : undefined}>
      <Dossier
        person={person}
        day={day}
        guesses={guesses}
        current={showSummary ? null : roundIndex}
        revealAll={showSummary}
      />

      <section className="stage">
        {showSummary ? (
          <Summary person={person} day={day} guesses={guesses} />
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
            maxYear={yearOfDay(day)}
            locked={locked as YearGuess | null}
            onLock={lock}
            onNext={proceed}
            nextLabel={nextLabel}
          />
        )}
      </section>

      <Panels day={day} />
    </main>
  );
}

function GameSkeleton() {
  return (
    <main className="game game-skeleton" aria-busy="true">
      <div className="dossier">
        <div className="portrait skeleton-block" />
      </div>
      <section className="stage">
        <div className="map-frame skeleton-block" />
      </section>
    </main>
  );
}
