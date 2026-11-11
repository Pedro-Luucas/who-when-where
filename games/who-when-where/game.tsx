"use client";

import { useState } from "react";
import { Daily } from "@/components/daily";
import { ResultActions } from "@/components/result-footer";
import { yearOfDay } from "@/lib/daily";
import { useSiteT } from "@/lib/i18n";
import { useGameT } from "./messages";
import { Panels } from "./panels";
import { personById, personForDay, type Person } from "./people";
import { Dossier } from "./dossier";
import { PlaceRound } from "./place-round";
import { ROUNDS, type Guess, type PlaceGuess, type YearGuess } from "./rules";
import { shareText } from "./share";
import { useSave } from "./store";
import { Summary } from "./summary";
import { YearRound } from "./year-round";

export function WhoWhenWhere() {
  // Keyed by day: at midnight the next puzzle starts from a clean slate.
  return <Daily>{(day) => <Play key={day} day={day} />}</Daily>;
}

function Play({ day }: { day: number }) {
  const [save, setSave] = useSave();
  const { locale, t } = useGameT();
  const siteT = useSiteT();

  // A saved record names its person, so a roster change can't reassign it.
  const stored = save.days[day];
  const record = stored && personById(stored.personId) ? stored : undefined;
  const person = (record && personById(record.personId)) ?? personForDay(day);
  const guesses = record?.guesses ?? [];

  function lock(guess: Guess) {
    setSave((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [day]: {
          personId: person.id,
          // Only a record of this very person is carried on: a stale one is replaced, never mixed in.
          guesses: [...(previous.days[day]?.personId === person.id ? previous.days[day].guesses : []), guess],
        },
      },
    }));
  }

  return (
    <>
      <WhoWhenWhereBoard
        person={person}
        guesses={guesses}
        onGuess={lock}
        maxYear={yearOfDay(day)}
        label={`${siteT("puzzleNo", { n: day })} — ${t("todaysMind")}`}
      >
        <ResultActions
          path="/who-when-where"
          shareText={(url) => shareText(day, guesses, locale, url)}
          nextLabel={t("nextIn")}
        />
      </WhoWhenWhereBoard>
      <Panels day={day} />
    </>
  );
}

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
