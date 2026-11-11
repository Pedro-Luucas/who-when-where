"use client";

import { Plaque } from "@/components/play/plaque";
import { useShellT } from "@/lib/shell-messages";
import { useGameT, type MessageKey } from "./messages";
import type { Person } from "./people";
import type { Round } from "./rules";

/** "Where was Charles Darwin *born*?" on the prompt plaque, with the starred word lit. */
export function Question({ person, round }: { person: Person; round: Round }) {
  const { locale, t } = useGameT();
  const shell = useShellT();
  const key = `q_${round.id}` as MessageKey;
  return (
    <Plaque eyebrow={shell(round.kind === "place" ? "plaquePin" : "plaqueYear")} text={t(key, { name: person.name[locale] })} />
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
