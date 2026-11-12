"use client";

import { Fragment, useEffect, useRef } from "react";
import { Hud, type HudStat } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ResultStat, type ReviewRow } from "@/components/play/result-card";
import { formatYear, translator, useLocale, type Locale } from "@/lib/i18n";
import { prefersReducedMotion } from "@/lib/motion";
import { useShellT } from "@/lib/shell-messages";
import type { HistoryEvent } from "../first-to-last/events";
import { SQUARE, headlineKey, shareLines } from "../engines/kit";
import { useBoardKeys, useReveal } from "../engines/reveal";
import { PASS } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { TRIES, scoreTimeline, walk, type Puzzle, type Step, type Verdict } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

type T = (key: MessageKey, vars?: { [name: string]: string | number }) => string;

const yearText = (event: HistoryEvent, locale: Locale, t: T) =>
  `${event.circa ? `${t("circa")} ` : ""}${formatYear(event.year, locale)}`;

/** "Between 1492 and 1517", "Before …", "After …": a gap, named by the cards either side. */
function gapWords(t: T, before: string | null, after: string | null): string {
  if (before !== null && after !== null) return t("between", { a: before, b: after });
  if (after !== null) return t("before", { a: after });
  return before !== null ? t("after", { a: before }) : "—";
}

type LineProps = {
  line: HistoryEvent[];
  starter: string;
  /** How each card placed so far went. */
  verdicts: Map<string, Verdict>;
  locale: Locale;
  t: T;
  /** Playing: a "place here" button in every gap. */
  onPlace?: (gap: number) => void;
  /** Keeps the gaps' room while there are no buttons in them, so the timeline does not jump. */
  spaced?: boolean;
  /** The card just placed, lit in its true place. */
  fresh?: string;
  /** Where a card placed wrong was put: a marker before the card at this index. */
  guessAt?: number;
  listRef?: React.Ref<HTMLOListElement>;
};

/** The timeline, earliest first: its cards, and (while playing) the gaps between them. */
function TimelineList({ line, starter, verdicts, locale, t, onPlace, spaced, fresh, guessAt, listRef }: LineProps) {
  const gap = (i: number) => {
    if (onPlace) {
      const words = gapWords(t, line[i - 1]?.name[locale] ?? null, line[i]?.name[locale] ?? null);
      return (
        <li className="tl-gap" key={`gap-${i}`}>
          <button type="button" data-gap={i} aria-label={`${t("placeHere")}: ${words}`} onClick={() => onPlace(i)}>
            <span>{t("placeHere")}</span>
          </button>
        </li>
      );
    }
    if (guessAt === i) {
      return (
        <li className="tl-guess" key={`guess-${i}`}>
          <span>{t("yourGuess")}</span>
        </li>
      );
    }
    return spaced ? <li className="tl-spacer" key={`gap-${i}`} aria-hidden="true" /> : null;
  };

  return (
    <ol className="tl-line" ref={listRef} aria-label={t("timelineLabel")} data-playing={onPlace || spaced ? "" : undefined}>
      {line.map((event, i) => (
        <Fragment key={event.id}>
          {gap(i)}
          <li
            className="tl-card"
            data-verdict={verdicts.get(event.id)}
            data-new={event.id === fresh ? "" : undefined}
            data-starter={event.id === starter ? "" : undefined}
          >
            <span className="tl-year">{yearText(event, locale, t)}</span>
            <span className="tl-what">
              <b>{event.name[locale]}</b>
              <small>
                {event.place[locale]}
                {event.id === starter && <span className="tl-tag">{t("starter")}</span>}
              </small>
            </span>
          </li>
        </Fragment>
      ))}
      {gap(line.length)}
    </ol>
  );
}

function Board({ puzzle, moves, onMove, onMoves, tries = TRIES, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const state = walk(puzzle, moves, tries);
  const reveal = useReveal(moves.length);
  const listRef = useRef<HTMLOListElement>(null);
  const total = puzzle.deck.length;
  const shown: Step | null = reveal.showing ? (state.steps.at(-1) ?? null) : null;
  const finished = state.over && shown === null;
  const verdicts = new Map(state.steps.map((step) => [step.event.id, step.verdict]));
  const livesLeft = Math.max(0, tries - state.misses);
  const card = shown?.event ?? state.next;
  const index = shown ? state.steps.length - 1 : state.steps.length;

  // The card just placed may have landed far down the timeline: bring it into view.
  const freshId = shown?.event.id;
  useEffect(() => {
    if (!freshId) return;
    listRef.current
      ?.querySelector("[data-new]")
      ?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [freshId]);

  function place(gap: number) {
    if (shown || state.over) return;
    onMove(String(gap));
  }

  function giveUp() {
    if (state.over) return;
    reveal.skip(1);
    onMoves([PASS]);
  }

  useBoardKeys((key) => {
    if (finished) return false;
    if (shown) {
      if (key === "Enter" || key === "ArrowRight" || key === " ") {
        reveal.next();
        return true;
      }
      return false;
    }
    if (key !== "ArrowDown" && key !== "ArrowUp") return false;
    const gaps = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-gap]") ?? [])];
    if (!gaps.length) return false;
    const at = gaps.findIndex((button) => button === document.activeElement);
    const next =
      at < 0 ? (key === "ArrowDown" ? 0 : gaps.length - 1) : Math.min(gaps.length - 1, Math.max(0, at + (key === "ArrowDown" ? 1 : -1)));
    gaps[next].focus();
    gaps[next].scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    return true;
  });

  const hudStats: HudStat[] = [
    { icon: "heart", label: shell("statLives"), value: `${livesLeft}/${tries}` },
    { icon: "target", label: shell("statCorrect"), value: state.correct },
  ];

  if (finished || !card) {
    const score = scoreTimeline(puzzle, moves, tries);
    const review: ReviewRow[] = state.steps.map((step) => {
      const year = yearText(step.event, locale, t);
      const [before, after] = step.between ?? [null, null];
      return {
        id: step.event.id,
        label: step.event.name[locale],
        verdict: step.verdict,
        yours:
          step.verdict === "skip"
            ? shell("gaveUp")
            : gapWords(t, before && yearText(before, locale, t), after && yearText(after, locale, t)),
        right: step.verdict === "hit" ? undefined : year,
        value: step.verdict === "hit" ? year : undefined,
      };
    });
    const stats: ResultStat[] = [
      {
        label: t("statPlaced"),
        value: `${state.correct}/${total}`,
        tone: state.correct === total ? "hit" : state.correct === 0 ? "miss" : undefined,
      },
      { label: t("statMistakes"), value: `${state.misses}/${tries}` },
      { label: shell("statBestRun"), value: state.bestRun },
    ];

    return (
      <main className="game" data-game={definition.slug} data-summary="">
        <Hud step={{ n: Math.max(1, state.steps.length), total, kind: "round" }} stats={hudStats} over />
        <aside className="dossier dossier-plain">
          <div className="dossier-text">
            <p className="eyebrow">{label}</p>
            <p className="dossier-description">{t("lead")}</p>
          </div>
        </aside>
        <section className="stage">
          <div className="summary">
            <ResultCard
              label={label}
              headline={shell(headlineKey(score.points))}
              answer={t("answer", { n: state.correct, total })}
              points={score.points}
              stats={stats}
              review={review}
            >
              {children}
            </ResultCard>
            <section className="tl-final" aria-labelledby="tl-final-title">
              <h3 id="tl-final-title" className="eyebrow">
                {t("finalTimeline")}
              </h3>
              <TimelineList line={state.line} starter={puzzle.starter.id} verdicts={verdicts} locale={locale} t={t} />
            </section>
          </div>
        </section>
      </main>
    );
  }

  const right = shown?.verdict === "hit";
  const guessAt =
    shown && shown.verdict === "miss" && shown.gap !== null
      ? shown.gap < shown.truth
        ? shown.gap
        : shown.gap + 1
      : undefined;

  return (
    <main className="game" data-game={definition.slug}>
      <Hud step={{ n: index + 1, total, kind: "round" }} stats={hudStats} onGiveUp={giveUp} over={state.over} />

      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className="dossier-lead">{t("lead")}</p>
        </div>
      </aside>

      <section className="stage" key={card.id}>
        <Plaque
          eyebrow={t("eyebrow")}
          text={t("prompt", { event: card.name[locale] })}
          tone={shown ? (right ? "on" : "off") : undefined}
          status={
            shown ? (
              <>
                <b>{right ? shell("pickRight") : shell("pickWrong")}</b> {t("itWas", { year: yearText(card, locale, t) })}
              </>
            ) : undefined
          }
        />

        <TimelineList
          line={state.line}
          starter={puzzle.starter.id}
          verdicts={verdicts}
          locale={locale}
          t={t}
          onPlace={shown ? undefined : place}
          spaced
          fresh={shown?.event.id}
          guessAt={guessAt}
          listRef={listRef}
        />

        {shown ? (
          <div className="tl-dock action-bar" role="status" data-tone={right ? "on" : "off"}>
            <div className="tl-hand">
              <span className="tl-year">{yearText(card, locale, t)}</span>
              <span className="tl-what">
                <b>{card.name[locale]}</b>
                {!right && (
                  <small className="tl-lives">
                    {livesLeft === 0 ? t("noneLeft") : livesLeft === 1 ? t("oneLeft") : t("mistakesLeft", { n: livesLeft })}
                  </small>
                )}
              </span>
            </div>
            <button type="button" className="button" onClick={reveal.next} autoFocus>
              {state.over ? shell("seeResult") : shell("nextRound")}
            </button>
          </div>
        ) : (
          <div className="tl-dock action-bar">
            <div className="tl-hand">
              <span className="tl-year" aria-hidden="true">
                ?
              </span>
              <span className="tl-what">
                <small className="eyebrow">{t("newCard")}</small>
                <b>{card.name[locale]}</b>
                <small>{card.place[locale]}</small>
              </span>
            </div>
            <p className="hint tl-hint">{t("hint")}</p>
          </div>
        )}
      </section>
    </main>
  );
}

const squareOf: Record<Verdict, string> = { hit: SQUARE.hit, miss: SQUARE.miss, skip: SQUARE.skip };

export default defineSetBoard<Puzzle, string, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const squares = walk(puzzle, moves)
      .steps.map((step) => squareOf[step.verdict])
      .join("");
    return shareLines(definition.title, day, scoreTimeline(puzzle, moves).points, squares, url);
  },
});
