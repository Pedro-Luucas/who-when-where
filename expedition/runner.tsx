"use client";

import { Suspense, use, useEffect, useEffectEvent, useMemo, useSyncExternalStore } from "react";
import { GameFrameProvider } from "@/games/platform/frame";
import { GAME_TITLES, gameBySlug } from "@/games/registry";
import { cue, cuePuzzle } from "@/lib/fx";
import { formatNumber } from "@/lib/i18n";
import { useSocialT } from "@/social/messages";
import { gradeOf, runTotal, type Run, type StageResult } from "./run";
import { normalizeSettings } from "./settings";
import { dealStages, loadBoards, stageAnswer, stagePuzzle, stageScore } from "./stages";

type Props = {
  run: Run;
  /** Stores the run after a move, a result or a step forward. */
  onChange: (run: Run) => void;
  /** A puzzle has just been scored. */
  onResult?: (stage: number, result: StageResult) => void;
  /** The player has seen the last result and moved on: the run is over. */
  onFinish?: (run: Run) => void;
  /** Keeps the player on a finished puzzle (a party waiting for everyone): shown in place of moving on. */
  hold?: React.ReactNode;
  /** Sits at the end of the bar: who else is playing, a way out. */
  aside?: React.ReactNode;
};

/** Seconds left until `deadline` (ms since the epoch), ticking; 0 without one. */
function useSecondsLeft(deadline: number | null): number {
  return useSyncExternalStore(
    (onChange) => {
      if (deadline === null) return () => {};
      const timer = setInterval(onChange, 250);
      return () => clearInterval(timer);
    },
    () => (deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
    () => 0,
  );
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// The year dials stop at the current year.
const THIS_YEAR = new Date().getFullYear();

/** Plays a run's puzzles one after the other. Renders nothing once the run is over. */
export function Runner(props: Props) {
  return (
    // The games in the run are fetched before its first puzzle is shown.
    <Suspense
      fallback={
        <main className="page" aria-busy="true">
          <div className="page-skeleton skeleton-block" />
        </main>
      }
    >
      <Play {...props} />
    </Suspense>
  );
}

function Play({ run, onChange, onResult, onFinish, hold, aside }: Props) {
  const { locale, t } = useSocialT();
  // A run saved before tries were kept per game still names them the old way.
  const settings = useMemo(() => normalizeSettings(run.settings), [run.settings]);
  const dealt = use(dealStages(settings, run.seed));
  const boards = use(loadBoards(settings));
  const { stages } = dealt;
  const stage = stages[run.stage];
  const result: StageResult | undefined = run.results[run.stage];
  const limit = settings.timeLimit;
  const deadline = limit > 0 && stage && !result ? run.startedAt + limit * 1000 : null;
  const secondsLeft = useSecondsLeft(deadline);

  function finish(moves: unknown[], timedOut: boolean) {
    const score = stageScore(dealt, stage, moves, settings);
    const scored: StageResult = { points: score.points, detail: score.detail, ...(timedOut ? { timedOut } : {}) };
    onChange({ ...run, moves, results: [...run.results, scored] });
    onResult?.(run.stage, scored);
    cuePuzzle(score.points, timedOut || score.detail.startsWith("X"));
  }

  function move(next: unknown[]) {
    if (result || !next.length) return;
    const moves = [...run.moves, ...next];
    if (stageScore(dealt, stage, moves, settings).over) return finish(moves, false);
    onChange({ ...run, moves });
    cue("move");
  }

  // The clock ran out: the puzzle ends with what was earned so far.
  const expire = useEffectEvent(() => {
    if (stage && !result) finish(run.moves, true);
  });
  useEffect(() => {
    if (deadline === null) return;
    const timer = setTimeout(expire, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline]);

  if (!stage) return null;

  const last = run.stage === stages.length - 1;
  function next() {
    const forward: Run = { ...run, stage: run.stage + 1, moves: [], startedAt: Date.now() };
    onChange(forward);
    if (last) onFinish?.(forward);
    window.scrollTo({ top: 0 });
  }

  const label = t("stageOf", { n: run.stage + 1, total: stages.length });
  const total = runTotal(run.results);
  const Board = boards[stage.game]?.Board;
  const puzzle = stagePuzzle(dealt, stage);

  const onwards = result && (
    <div className="stage-footer" role="status">
      <p className="stage-points">
        <strong>+{formatNumber(result.points, locale)}</strong>
        <span>
          {t("points")} · {t("totalSoFar", { n: formatNumber(total, locale) })}
        </span>
      </p>
      {hold ?? (
        <button type="button" className="button" onClick={next} autoFocus>
          {last ? t("seeResults") : t("nextPuzzle")}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="run-bar">
        <span className="run-bar-stage">{label}</span>
        <ol className="run-dots" aria-hidden="true">
          {stages.map((entry, i) => {
            const scored = run.results[i];
            return (
              <li
                key={i}
                data-state={scored ? "done" : i === run.stage ? "current" : "todo"}
                data-grade={scored ? gradeOf(scored.points) : undefined}
                title={GAME_TITLES[entry.game]}
              />
            );
          })}
        </ol>
        {deadline !== null && (
          <time className="run-timer" data-low={secondsLeft <= 10 ? "" : undefined} aria-label={t("timeLeft")}>
            {clock(secondsLeft)}
          </time>
        )}
        <span className="run-total">
          {formatNumber(total, locale)} <small>{t("pts")}</small>
        </span>
        {aside}
      </div>

      {result?.timedOut ? (
        <main className="page timeout" role="status">
          <p className="eyebrow">
            {label} <span aria-hidden="true">—</span> {GAME_TITLES[stage.game]}
          </p>
          <h1>{t("timeUp")}</h1>
          <p className="timeout-answer">
            {t("itWas")} <b>{stageAnswer(dealt, stage, locale)}</b>
          </p>
          {onwards}
        </main>
      ) : Board && puzzle !== undefined ? (
        // Keyed by stage: each puzzle starts from a clean board.
        <GameFrameProvider value={{ slug: stage.game, title: GAME_TITLES[stage.game], family: gameBySlug(stage.game).family, daily: false }}>
        <Board
          key={`${run.id}:${run.stage}`}
          puzzle={puzzle}
          moves={run.moves}
          onMove={(next) => move([next])}
          onMoves={move}
          tries={settings.tries[stage.game]}
          year={THIS_YEAR}
          label={`${label} — ${GAME_TITLES[stage.game]}`}
        >
          {onwards}
        </Board>
        </GameFrameProvider>
      ) : null}
    </>
  );
}
