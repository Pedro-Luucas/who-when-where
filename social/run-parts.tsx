"use client";

import { Suspense, use, useMemo } from "react";
import { Chip } from "@/components/ui/chip";
import { gradeOf, runTotal } from "@/expedition/run";
import { gamesIn, normalizeSettings, type ExpeditionSettings } from "@/expedition/settings";
import { dealStages, stageAnswer } from "@/expedition/stages";
import { GAME_TITLES, gameBySlug } from "@/games/registry";
import { formatNumber } from "@/lib/i18n";
import type { StageScore } from "./connect";
import { useConnectT } from "./connect-messages";

// Pieces shared by the pages that play a stored run (a challenge, the Weekly
// Special): the games in it, and two players' scores puzzle by puzzle.

/** The games a run deals from, as family chips with their puzzle counts. */
export function RunGames({ settings }: { settings: ExpeditionSettings }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {gamesIn(settings).map((game) => (
        <li key={game}>
          <Chip family={gameBySlug(game).family}>
            {GAME_TITLES[game]}
            {settings.rounds[game] > 1 ? ` ×${settings.rounds[game]}` : ""}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

const SQUARES = ["⬛", "🟥", "🟧", "🟨", "🟩"];

/** The coloured squares of a run's scores, for share texts. */
export const runSquares = (results: { points: number }[]) => results.map((result) => SQUARES[gradeOf(result.points)]).join("");

type HeadToHeadProps = {
  settings: ExpeditionSettings;
  seed: string;
  mine: StageScore[];
  theirs: StageScore[];
  /** The other player's name, for the column. */
  name: string;
};

/** Two players' scores on the same puzzles, side by side, with what each puzzle was. */
export function HeadToHead(props: HeadToHeadProps) {
  return (
    <Suspense fallback={<div className="skeleton-block h-40" aria-busy="true" />}>
      <Rows {...props} />
    </Suspense>
  );
}

function Rows({ settings, seed, mine, theirs, name }: HeadToHeadProps) {
  const { locale, t } = useConnectT();
  const whole = useMemo(() => normalizeSettings(settings), [settings]);
  const dealt = use(dealStages(whole, seed));
  return (
    <div role="table" aria-label={t("h2h")}>
      <div role="row" className="h2h-row font-mono text-xs tracking-[0.08em] text-fg-2 uppercase">
        <span role="columnheader">{t("h2hPuzzle", { n: "" }).trim()}</span>
        <b role="columnheader">{t("you")}</b>
        <b role="columnheader" className="truncate">
          {name}
        </b>
      </div>
      {dealt.stages.map((stage, i) => {
        const a = mine[i]?.points;
        const b = theirs[i]?.points;
        return (
          <div role="row" key={i} className="h2h-row">
            <span role="cell" className="min-w-0">
              <b className="block truncate text-fg">{stageAnswer(dealt, stage, locale) || t("h2hPuzzle", { n: i + 1 })}</b>
              <small className="font-mono text-xs text-fg-3">{GAME_TITLES[stage.game]}</small>
            </span>
            <b role="cell" data-best={a !== undefined && b !== undefined && a > b ? "" : undefined}>
              {a === undefined ? "—" : formatNumber(a, locale)}
            </b>
            <b role="cell" data-best={a !== undefined && b !== undefined && b > a ? "" : undefined}>
              {b === undefined ? "—" : formatNumber(b, locale)}
            </b>
          </div>
        );
      })}
      <div role="row" className="h2h-row border-b-0 font-semibold">
        <span role="cell" className="font-mono text-xs tracking-[0.08em] text-fg-2 uppercase">
          Σ
        </span>
        <b role="cell" className="!text-fg">{formatNumber(runTotal(mine), locale)}</b>
        <b role="cell" className="!text-fg">{formatNumber(runTotal(theirs), locale)}</b>
      </div>
    </div>
  );
}
