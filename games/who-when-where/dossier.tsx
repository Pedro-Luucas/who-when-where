"use client";

import Image from "next/image";
import { useSiteT } from "@/lib/i18n";
import { useGameT } from "./messages";
import type { Person } from "./people";
import { ROUNDS, type Guess } from "./rules";

type Props = {
  person: Person;
  day: number;
  guesses: Guess[];
  /** Index of the round being played, or null on the summary. */
  current: number | null;
  /** Show the life dates under the name (only once the puzzle is over). */
  revealAll: boolean;
};

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

/** The "specimen card": who today's person is, and how far along the player is. */
export function Dossier({ person, day, guesses, current, revealAll }: Props) {
  const { locale, t } = useGameT();
  const site = useSiteT();

  return (
    <aside className="dossier">
      {person.image && (
        <div className="portrait">
          <Image
            src={person.image.src}
            alt={person.name[locale]}
            width={person.image.width}
            height={person.image.height}
            sizes="(min-width: 1024px) 280px, 96px"
            priority
          />
        </div>
      )}

      <div className="dossier-text">
        <p className="eyebrow">
          {site("puzzleNo", { n: day })} <span aria-hidden="true">—</span> {t("todaysMind")}
        </p>
        <h1 className="dossier-name">{person.name[locale]}</h1>
        <p className="dossier-description">
          {person.description[locale]}
          {revealAll && (
            <span className="dossier-dates">
              {person.birth.year}–{person.death.year}
            </span>
          )}
        </p>
      </div>

      <ol className="progress">
        {ROUNDS.map((round, i) => {
          const guess = guesses[i];
          const state = i === current ? "current" : guess ? "done" : "todo";
          // "Born · where": stacked on phones, on one line where there is room.
          const [event, kind] = t(`r_${round.id}`).split(" · ");
          return (
            <li key={round.id} data-state={state} aria-current={i === current ? "step" : undefined}>
              <span className="progress-numeral">{NUMERALS[i]}</span>
              <span className="progress-label">
                <span>{event}</span>
                <i aria-hidden="true"> · </i>
                <span>{kind}</span>
              </span>
              <span className="progress-score">{guess ? guess.score : "—"}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
