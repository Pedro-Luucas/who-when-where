"use client";

import { useMemo } from "react";
import { GAME_TITLES } from "@/games/slugs";
import { formatNumber } from "@/lib/i18n";
import { useSocialT } from "@/social/messages";
import { gradeOf, runMax, runTotal, type Run } from "./run";
import { buildStages, stageAnswer } from "./stages";

/** The score of a finished run, and what each puzzle was and earned. */
export function RunSummary({ run }: { run: Run }) {
  const { locale, t } = useSocialT();
  const stages = useMemo(() => buildStages(run.settings, run.seed), [run.settings, run.seed]);
  const total = runTotal(run.results);

  return (
    <>
      <header className="summary-score">
        <p className="eyebrow">{t("expeditionOver")}</p>
        <p className="summary-total">
          <strong>{formatNumber(total, locale)}</strong>
          <span>/ {formatNumber(runMax(run.settings), locale)}</span>
        </p>
      </header>

      <ol className="stage-list">
        {stages.map((stage, i) => {
          const result = run.results[i];
          return (
            <li key={i} data-grade={result ? gradeOf(result.points) : undefined}>
              <span className="stage-list-n">{i + 1}</span>
              <span className="stage-list-text">
                <b>{stageAnswer(stage, locale)}</b>
                <small>
                  {GAME_TITLES[stage.game]}
                  {result?.timedOut ? ` · ${t("timeUp")}` : result && stage.game !== "who-when-where" ? ` · ${result.detail}` : ""}
                </small>
              </span>
              <span className="stage-list-points">{result ? formatNumber(result.points, locale) : "—"}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

const SQUARES = ["⬛", "🟥", "🟧", "🟨", "🟩"];

/** The spoiler-free result players paste into chats. */
export function runShareText(run: Run, locale: "en" | "pt", url: string): string {
  const total = formatNumber(runTotal(run.results), locale);
  const max = formatNumber(runMax(run.settings), locale);
  const trail = run.results.map((result) => SQUARES[gradeOf(result.points)]).join("");
  const dare = locale === "pt" ? "Faz melhor? Mesmos desafios:" : "Can you beat it? Same puzzles:";
  return [`Who When Where · ${locale === "pt" ? "Expedição" : "Expedition"} · ${total}/${max}`, `🧭 ${trail}`, dare, url].join(
    "\n",
  );
}
