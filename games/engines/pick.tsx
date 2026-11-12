"use client";

import { Hud, type HudStat, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ResultStat, type ReviewRow } from "@/components/play/result-card";
import { useShellT } from "@/lib/shell-messages";
import { useBoardKeys, useReveal } from "./reveal";
import { PASS, pickScore, tallyPicks, type PickTally } from "./rules";

// The Pick engine: a run of rounds, each a choice between a few options —
// four people, two countries, "before" or "after". Optionally with lives: the
// run ends at the last round or the last life. After each answer the board
// shows why it was right or wrong, then moves on when the player asks.
// A game supplies the rounds (what to show, the options, the answer) and the
// words of its result; the HUD, the verdicts, the scoring (games/engines/
// rules.ts) and the result card are the engine's.

export type PickOption = {
  id: string;
  label: React.ReactNode;
  /** Under the label before the answer: a hint that gives nothing away. */
  sub?: React.ReactNode;
  /** Under the label once the round is answered: the fact that decides it ("214 million"). */
  fact?: React.ReactNode;
  /** A picture or a flag above the label. */
  media?: React.ReactNode;
  /** The option in words, for the review and screen readers, when `label` is not plain text. */
  text?: string;
};

export type PickRound = {
  key: string;
  eyebrow: string;
  /** The question. Words in *asterisks* are lit. */
  prompt: string;
  /** What the round is about, between the prompt and the options (a map, two lifelines). Told the answer once it is given. */
  scene?: (answered: boolean) => React.ReactNode;
  options: PickOption[];
  answer: string;
  /** A line after the answer: why it is so. */
  reveal?: React.ReactNode;
  /** The round's name in the review ("Lagos"); "Round n" when left out. */
  review?: string;
};

type Props = {
  /** For styling: data-game on the board. */
  game: string;
  rounds: PickRound[];
  moves: string[];
  onMove: (move: string) => void;
  onMoves: (moves: string[]) => void;
  /** The run ends after this many wrong answers. */
  lives?: number;
  /** grid: two by two · pair: two big cards · binary: two words side by side · list: one per line. */
  layout?: "grid" | "pair" | "binary" | "list";
  /** The line above the title: "No. 12 — Today's run". */
  label: string;
  /** The game in a sentence, under the label. */
  lead: string;
  headline: (tally: PickTally) => React.ReactNode;
  /** The line under the verdict. */
  answer: (tally: PickTally) => React.ReactNode;
  /** More numbers for the result card. */
  stats?: ResultStat[];
  /** Below the result card: a map, a list, a source line. */
  after?: React.ReactNode;
  /** What follows the score once it is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

const optionText = (option: PickOption | undefined): string =>
  option ? (option.text ?? (typeof option.label === "string" ? option.label : option.id)) : "";

export function PickBoard({
  game,
  rounds,
  moves,
  onMove,
  onMoves,
  lives,
  layout = "grid",
  label,
  lead,
  headline,
  answer,
  stats = [],
  after,
  children,
}: Props) {
  const shell = useShellT();
  const answers = rounds.map((round) => round.answer);
  const tally = tallyPicks(answers, moves, lives);
  const reveal = useReveal(moves.length);
  // The round whose answer is on screen, or the one being played.
  const showing = reveal.showing && tally.played > 0 ? tally.played - 1 : null;
  const index = Math.min(showing ?? tally.played, rounds.length - 1);
  const round = rounds[index];
  const chosen = showing === null ? null : moves[showing];
  const finished = tally.over && showing === null;
  const score = pickScore(answers, moves, lives);

  function choose(id: string) {
    if (showing !== null || tally.over) return;
    onMove(id);
  }

  function giveUp() {
    const left = rounds.length - moves.length;
    if (left <= 0) return;
    reveal.skip(left);
    onMoves(Array.from({ length: left }, () => PASS));
  }

  useBoardKeys((key) => {
    if (finished) return false;
    if (showing !== null) {
      if (key === "Enter" || key === "ArrowRight" || key === " ") {
        reveal.next();
        return true;
      }
      return false;
    }
    const n = Number(key);
    if (Number.isInteger(n) && n >= 1 && n <= round.options.length) {
      choose(round.options[n - 1].id);
      return true;
    }
    return false;
  });

  const verdictOf = (i: number) => (moves[i] === PASS ? "skip" : tally.rounds[i] ? "hit" : "miss");
  const pips: Pip[] | undefined =
    rounds.length <= 15
      ? rounds.map((_, i) => (i < tally.played ? verdictOf(i) : i === tally.played && !tally.over ? "current" : "todo"))
      : undefined;
  const hudStats: HudStat[] = [{ icon: "target", label: shell("statCorrect"), value: tally.correct }];
  if (lives !== undefined) {
    hudStats.unshift({ icon: "heart", label: shell("statLives"), value: `${Math.max(0, lives - tally.misses)}/${lives}` });
  }

  if (finished) {
    const review: ReviewRow[] = rounds.slice(0, tally.played).map((entry, i) => {
      const option = entry.options.find((item) => item.id === moves[i]);
      const verdict = verdictOf(i);
      return {
        id: entry.key,
        label: entry.review ?? shell("roundN", { n: i + 1 }),
        verdict,
        yours: verdict === "skip" ? shell("gaveUp") : optionText(option),
        right: verdict === "hit" ? undefined : optionText(entry.options.find((item) => item.id === entry.answer)),
      };
    });
    const resultStats = ([
      {
        label: shell("statCorrect"),
        value: `${tally.correct}/${rounds.length}`,
        tone: tally.correct === rounds.length ? "hit" : tally.correct === 0 ? "miss" : undefined,
      },
      { label: shell("statBestRun"), value: tally.bestRun },
      ...(lives !== undefined
        ? [{ label: shell("statLives"), value: `${Math.max(0, lives - tally.misses)}/${lives}` }]
        : []),
      ...stats,
    ] satisfies ResultStat[]).slice(0, 4);

    return (
      <main className="game" data-game={game} data-engine="pick" data-summary="">
        <Hud step={{ n: tally.played, total: rounds.length, kind: "round" }} pips={pips} stats={hudStats} over />
        <aside className="dossier dossier-plain">
          <div className="dossier-text">
            <p className="eyebrow">{label}</p>
            <p className="dossier-description">{lead}</p>
          </div>
        </aside>
        <section className="stage">
          <div className="summary">
            <ResultCard
              label={label}
              headline={headline(tally)}
              answer={answer(tally)}
              points={score.points}
              stats={resultStats}
              review={review}
            >
              {children}
            </ResultCard>
            {after}
          </div>
        </section>
      </main>
    );
  }

  const answered = chosen !== null;
  const right = answered && chosen === round.answer;
  const rightOption = round.options.find((option) => option.id === round.answer);
  const livesLeft = lives === undefined ? null : Math.max(0, lives - tally.misses);

  return (
    <main className="game" data-game={game} data-engine="pick">
      <Hud
        step={{ n: index + 1, total: rounds.length, kind: "round" }}
        pips={pips}
        stats={hudStats}
        onGiveUp={giveUp}
        over={tally.over}
      />

      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className="dossier-lead">{lead}</p>
        </div>
      </aside>

      <section className="stage" key={round.key}>
        <Plaque
          eyebrow={round.eyebrow}
          text={round.prompt}
          tone={answered ? (right ? "on" : "off") : undefined}
          status={
            answered ? (
              <>
                <b>{right ? shell("pickRight") : chosen === PASS ? shell("gaveUp") : shell("pickWrong")}</b>{" "}
                {!right && rightOption && shell("pickItWas", { answer: optionText(rightOption) })}
              </>
            ) : undefined
          }
        />

        {round.scene?.(answered)}

        <ul className="pick-options" data-layout={layout} data-answered={answered ? "" : undefined}>
          {round.options.map((option, i) => {
            const state = !answered
              ? undefined
              : option.id === round.answer
                ? "right"
                : option.id === chosen
                  ? "wrong"
                  : "other";
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className="pick-option"
                  data-state={state}
                  disabled={answered}
                  aria-pressed={answered ? option.id === chosen : undefined}
                  aria-keyshortcuts={String(i + 1)}
                  onClick={() => choose(option.id)}
                >
                  {option.media && <span className="pick-media">{option.media}</span>}
                  <span className="pick-label">{option.label}</span>
                  {answered && option.fact !== undefined ? (
                    <span className="pick-fact">{option.fact}</span>
                  ) : (
                    option.sub !== undefined && <span className="pick-sub">{option.sub}</span>
                  )}
                  <kbd className="pick-key" aria-hidden="true">
                    {i + 1}
                  </kbd>
                </button>
              </li>
            );
          })}
        </ul>

        {answered ? (
          <div className="pick-verdict action-bar" role="status" data-tone={right ? "on" : "off"}>
            <div className="pick-verdict-text">
              {round.reveal && <p>{round.reveal}</p>}
              {livesLeft !== null && !right && (
                <p className="pick-lives">
                  {livesLeft === 0 ? shell("noLivesLeft") : shell("livesLeft", { n: livesLeft })}
                </p>
              )}
            </div>
            <button type="button" className="button" onClick={reveal.next} autoFocus>
              {tally.over ? shell("seeResult") : shell("nextRound")}
            </button>
          </div>
        ) : (
          <p className="hint pick-hint">{shell("pickHint")}</p>
        )}
      </section>
    </main>
  );
}
