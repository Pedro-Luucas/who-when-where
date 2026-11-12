"use client";

import { useState } from "react";
import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ResultStat, type ReviewRow } from "@/components/play/result-card";
import { useFinePointer } from "@/lib/pointer";
import { useShellT } from "@/lib/shell-messages";
import { useOrderKeys, withoutLastPick } from "./reveal";
import { inPlace, orderOver, orderScore, orderSolved, type OrderAttempt } from "./rules";

// The Order engine: a handful of things to put in order (by birth, by date,
// by size). Tap them into the slots, check; the ones in the right place lock
// and the rest go back to be tried again, a few times. First to Last was the
// first game of this kind; this is the same play, for any list.

const LETTERS = "ABCDEFGHIJ";

export type OrderItem = {
  id: string;
  /** The item's name, in words: on its card, and for screen readers. */
  name: string;
  /** A short line under the name, that does not give the order away. */
  note?: React.ReactNode;
  /** What decides its place, shown once the puzzle is over ("1809"). */
  value: React.ReactNode;
  /** A small picture at the start of its card. */
  media?: React.ReactNode;
};

type Props = {
  game: string;
  /** The items, in the order they are lettered. */
  items: OrderItem[];
  /** Their ids in the right order. */
  truth: string[];
  attempts: OrderAttempt[];
  onAttempt: (attempt: OrderAttempt) => void;
  /** Adds several attempts at once (giving up repeats the last one for every try left). */
  onAttempts: (attempts: OrderAttempt[]) => void;
  max: number;
  label: string;
  lead: string;
  eyebrow: string;
  /** The question; words in *asterisks* are lit. */
  prompt: string;
  /** The two ends of the line: "Born first", "Born last". */
  ends: { first: string; last: string };
  /** The result's verdict: solved on which try, or how many were in place. */
  headline: (solved: boolean, tries: number, placed: number) => React.ReactNode;
  answer: React.ReactNode;
  stats?: ResultStat[];
  /** Below the right order once it is over (a chart of lifelines). */
  after?: React.ReactNode;
  children?: React.ReactNode;
};

export function OrderBoard({
  game,
  items,
  truth,
  attempts,
  onAttempt,
  onAttempts,
  max,
  label,
  lead,
  eyebrow,
  prompt,
  ends,
  headline,
  answer,
  stats = [],
  after,
  children,
}: Props) {
  const shell = useShellT();
  const mouse = useFinePointer();
  const solved = orderSolved(attempts, truth);
  const over = orderOver(attempts, truth, max);
  const last = attempts.at(-1);

  // Positions the last attempt got right keep their item; the player fills the others.
  const locked = truth.map((id, i) => (last?.[i] === id ? id : null));
  const [picks, setPicks] = useState<(string | null)[]>(() => truth.map(() => null));
  const order = locked.map((id, i) => id ?? picks[i]);
  const full = order.every((id) => id !== null);
  const nextFree = order.indexOf(null);

  const byId = new Map(items.map((item, i) => [item.id, { item, letter: LETTERS[i] }]));

  /** Puts an item in the first free slot, or takes it back. */
  function toggle(id: string) {
    if (over || locked.includes(id)) return;
    const at = order.indexOf(id);
    const target = at >= 0 ? at : nextFree;
    if (target === -1) return;
    setPicks(order.map((current, i) => (i === target ? (at >= 0 ? null : id) : current)));
  }

  function check() {
    if (!full || over) return;
    onAttempt(order as string[]);
    setPicks(truth.map(() => null));
  }

  useOrderKeys({
    ids: items.map((entry) => entry.id),
    toggle,
    undo() {
      const next = withoutLastPick(picks, locked);
      if (next) setPicks(next);
      return next !== null;
    },
    check,
    full,
    active: !over,
  });

  const triesLeft = max - attempts.length;
  const right = last ? inPlace(last, truth) : 0;
  // A try given up repeats the one before it (or is empty): it changes nothing.
  const isGivenUp = (i: number) =>
    attempts[i].length === 0 || (i > 0 && attempts[i].join() === attempts[i - 1].join());
  const verdict = (attempt: OrderAttempt, i: number) => {
    if (isGivenUp(i)) return "skip" as const;
    const placed = inPlace(attempt, truth);
    return placed === truth.length ? ("hit" as const) : placed >= truth.length / 2 ? ("near" as const) : ("miss" as const);
  };
  const pips: Pip[] = Array.from({ length: max }, (_, i) =>
    attempts[i] ? verdict(attempts[i], i) : i === attempts.length && !over ? "current" : "todo",
  );
  const letters = (attempt: OrderAttempt) => attempt.map((id) => byId.get(id)?.letter).join(" ");

  return (
    <main className="game" data-game={game} data-engine="order" data-summary={over ? "" : undefined}>
      <Hud
        step={{ n: Math.min(attempts.length + 1, max), total: max, kind: "try" }}
        pips={pips}
        stats={[{ icon: "flag", label: shell("statInPlace"), value: `${right}/${truth.length}` }]}
        onGiveUp={() => onAttempts(Array.from({ length: max - attempts.length }, () => last ?? []))}
        over={over}
      />

      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className={over ? "dossier-description" : "dossier-lead"}>{lead}</p>
        </div>
      </aside>

      <section className="stage">
        {over ? (
          <div className="summary">
            <ResultCard
              label={label}
              headline={headline(solved, attempts.length, right)}
              answer={answer}
              points={orderScore(truth, attempts, max).points}
              stats={([
                { label: shell("statTries"), value: `${solved ? attempts.length : "X"}/${max}`, tone: solved ? "hit" : "miss" },
                { label: shell("statInPlace"), value: `${right}/${truth.length}` },
                ...stats,
              ] satisfies ResultStat[]).slice(0, 4)}
              review={attempts.map((attempt, i) => ({
                id: String(i),
                label: shell("tryN", { n: i + 1 }),
                verdict: verdict(attempt, i),
                yours: isGivenUp(i) ? shell("gaveUp") : letters(attempt),
                right: i === attempts.length - 1 && !solved ? letters(truth) : undefined,
                value: `${inPlace(attempt, truth)}/${truth.length}`,
              })) satisfies ReviewRow[]}
            >
              {children}
            </ResultCard>
            <ol className="events order-truth">
              {truth.map((id, i) => {
                const entry = byId.get(id);
                if (!entry) return null;
                return (
                  <li key={id}>
                    <div className="event" data-state={last?.[i] === id ? "locked" : "miss"}>
                      <span className="event-letter">{i + 1}</span>
                      {entry.item.media && <span className="order-media">{entry.item.media}</span>}
                      <span className="event-text">
                        <b>{entry.item.name}</b>
                        {entry.item.note && <small>{entry.item.note}</small>}
                      </span>
                      <span className="event-year">{entry.item.value}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
            {after}
          </div>
        ) : (
          <>
            <Plaque
              eyebrow={eyebrow}
              text={prompt}
              tone={last ? (right >= truth.length / 2 ? "near" : "off") : undefined}
              status={
                last &&
                `${right ? shell("orderFeedback", { n: right }) : shell("orderFeedbackNone")} ${
                  triesLeft === 1 ? shell("orderLastTry") : shell("orderTriesLeft", { n: triesLeft })
                }`
              }
            />
            <div className="slots-frame">
              <span className="eyebrow">{ends.first}</span>
              <ol className="slots" style={{ gridTemplateColumns: `repeat(${truth.length}, minmax(0, 1fr))` }}>
                {order.map((id, i) => {
                  const state = locked[i] ? "locked" : id ? "placed" : i === nextFree ? "next" : "empty";
                  return (
                    <li key={i} data-state={state}>
                      <small>{i + 1}</small>
                      {id && !locked[i] ? (
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          aria-label={`${shell("orderRemove")}: ${byId.get(id)?.item.name}`}
                        >
                          {byId.get(id)?.letter}
                        </button>
                      ) : (
                        <b>{id ? byId.get(id)?.letter : "·"}</b>
                      )}
                    </li>
                  );
                })}
              </ol>
              <span className="eyebrow">{ends.last}</span>
            </div>

            <ul className="events">
              {items.map((item, i) => {
                const position = order.indexOf(item.id);
                const isLocked = locked.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="event"
                      data-state={isLocked ? "locked" : position >= 0 ? "placed" : undefined}
                      disabled={isLocked || (position === -1 && full)}
                      aria-pressed={position >= 0}
                      onClick={() => toggle(item.id)}
                    >
                      <span className="event-letter">{LETTERS[i]}</span>
                      {item.media && <span className="order-media">{item.media}</span>}
                      <span className="event-text">
                        <b>{item.name}</b>
                        {item.note && <small>{item.note}</small>}
                      </span>
                      <span className="event-position">{position >= 0 ? position + 1 : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="controls action-bar">
              <p className="hint">{shell(mouse ? "orderHowToMouse" : "orderHowTo")}</p>
              <button type="button" className="button" disabled={!full} onClick={check}>
                {shell("orderCheck")}
              </button>
            </div>

            {attempts.length > 0 && (
              <ol className="ftl-history" aria-label={shell("orderYourTries")}>
                {attempts.map((attempt, n) => (
                  <li key={n}>
                    <span className="ftl-n">{n + 1}</span>
                    <ol aria-label={letters(attempt)}>
                      {attempt.map((id, i) => (
                        <li key={i} data-state={truth[i] === id ? "hit" : "miss"}>
                          {byId.get(id)?.letter}
                        </li>
                      ))}
                    </ol>
                    <span className="ftl-score">
                      {inPlace(attempt, truth)}/{truth.length}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>
    </main>
  );
}
