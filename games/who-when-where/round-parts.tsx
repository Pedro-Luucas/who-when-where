"use client";

import { useGameT, type MessageKey } from "./messages";
import type { Person } from "./people";
import type { Round } from "./rules";

/** "Where was Charles Darwin *born*?" with the starred word emphasised. */
export function Question({ person, round }: { person: Person; round: Round }) {
  const { locale, t } = useGameT();
  const key = `q_${round.id}` as MessageKey;
  const parts = t(key, { name: person.name[locale] }).split("*");
  return (
    <h2 className="question">
      {parts.map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
    </h2>
  );
}

/** The rubber stamp that lands when a round is scored. */
export function ScoreStamp({ score }: { score: number }) {
  const { t } = useGameT();
  return (
    <div className="stamp" aria-label={`${score} ${t("points")}`}>
      <strong>+{score}</strong>
      <span>{t("points")}</span>
    </div>
  );
}
