"use client";

import { useState } from "react";
import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ReviewRow } from "@/components/play/result-card";
import { WorldMap, useMapLabels, type MapMarker, type MapRoute } from "@/components/world-map";
import { formatYear } from "@/lib/i18n";
import { useFinePointer } from "@/lib/pointer";
import { useShellT } from "@/lib/shell-messages";
import { chronological, type HistoryEvent } from "./events";
import { useGameT } from "./messages";
import { MAX_ATTEMPTS, inPlace, isOver, isSolved, scoreOf, truthOf, type Attempt } from "./rules";

const LETTERS = "ABCDEFGH";

type BoardProps = {
  /** The puzzle's events, in the order they are lettered. */
  events: HistoryEvent[];
  attempts: Attempt[];
  onAttempt: (order: Attempt) => void;
  /** Adds several attempts at once (giving up repeats the last one for every try left). */
  onAttempts: (orders: Attempt[]) => void;
  maxAttempts?: number;
  /** The line above the title: "No. 12 — Today's line-up", "Stage 3 of 8 — First to Last". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

/** One First to Last puzzle. The attempts live with whoever renders it. */
export function FirstToLastBoard({
  events,
  attempts,
  onAttempt,
  onAttempts,
  maxAttempts = MAX_ATTEMPTS,
  label,
  children,
}: BoardProps) {
  const { locale, t } = useGameT();
  const shell = useShellT();
  const mapLabels = useMapLabels();
  const mouse = useFinePointer();

  const truth = truthOf(events);
  const solved = isSolved(attempts, truth);
  const over = isOver(attempts, truth, maxAttempts);
  const last = attempts.at(-1);

  // Positions the last attempt got right keep their event; the player fills
  // the others.
  const locked = truth.map((id, i) => (last?.[i] === id ? id : null));
  const [picks, setPicks] = useState<(string | null)[]>(() => truth.map(() => null));
  const order = locked.map((id, i) => id ?? picks[i]);
  const full = order.every((id) => id !== null);
  const nextFree = order.indexOf(null);

  const byId = new Map(events.map((event, i) => [event.id, { event, letter: LETTERS[i] }]));
  const yearText = (event: HistoryEvent) =>
    `${event.circa ? `${t("circa")} ` : ""}${formatYear(event.year, locale)}`;

  /** Places an event in the first free position, or takes it back. */
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

  const markers: MapMarker[] = events.map((event, i) => {
    const isLocked = locked.includes(event.id);
    return {
      lat: event.lat,
      lon: event.lon,
      kind: "pin",
      badge: over ? String(truth.indexOf(event.id) + 1) : LETTERS[i],
      tone: over || isLocked ? "locked" : order.includes(event.id) ? "placed" : undefined,
      label: over ? yearText(event) : undefined,
      onSelect: over || isLocked ? undefined : () => toggle(event.id),
      title: `${LETTERS[i]}: ${event.name[locale]}`,
    };
  });

  // The thread follows the order so far: one line per unbroken run of
  // positions. Once the puzzle is over it runs through history as it happened.
  const routes: MapRoute[] = [];
  if (over) {
    routes.push({ points: chronological(events), kind: "route", draw: true, id: "truth" });
  } else {
    let run: HistoryEvent[] = [];
    for (const id of [...order, null]) {
      const event = id ? byId.get(id)?.event : undefined;
      if (event) run.push(event);
      else {
        if (run.length > 1) routes.push({ points: run, kind: "thread" });
        run = [];
      }
    }
  }

  const triesLeft = maxAttempts - attempts.length;
  const right = last ? inPlace(last, truth) : 0;

  // A try given up repeats the one before it (or is empty): it changes nothing, it only uses the try.
  const passed = (i: number) => i > 0 && (attempts[i].length === 0 || attempts[i].join() === attempts[i - 1].join());
  const isGivenUp = (i: number) => attempts[i].length === 0 || passed(i);
  const pips: Pip[] = Array.from({ length: maxAttempts }, (_, i) => {
    const attempt = attempts[i];
    if (!attempt) return i === attempts.length && !over ? "current" : "todo";
    if (isGivenUp(i)) return "skip";
    const placed = inPlace(attempt, truth);
    return placed === truth.length ? "hit" : placed >= truth.length / 2 ? "near" : "miss";
  });
  const review: ReviewRow[] = attempts.map((attempt, i) => {
    const placed = inPlace(attempt, truth);
    return {
      id: String(i),
      label: shell("tryN", { n: i + 1 }),
      verdict: isGivenUp(i) ? "skip" : placed === truth.length ? "hit" : placed >= truth.length / 2 ? "near" : "miss",
      yours: isGivenUp(i) ? shell("gaveUp") : attempt.map((id) => byId.get(id)?.letter).join(" "),
      right: i === attempts.length - 1 ? truth.map((id) => byId.get(id)?.letter).join(" ") : undefined,
      value: `${placed}/${truth.length}`,
    };
  });
  const map = <WorldMap markers={markers} routes={routes} focus={events} labels={mapLabels} ariaLabel={t("mapAria")} />;
  const question = t("question")
    .split("*")
    .map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));

  return (
    <main className="game" data-game="first-to-last" data-summary={over ? "" : undefined}>
      <Hud
        step={{ n: Math.min(attempts.length + 1, maxAttempts), total: maxAttempts, kind: "try" }}
        pips={pips}
        stats={[{ icon: "flag", label: shell("statInPlace"), value: `${right}/${truth.length}` }]}
        onGiveUp={() => onAttempts(Array.from({ length: maxAttempts - attempts.length }, () => last ?? []))}
        over={over}
      />

      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          {over && <h1 className="dossier-name">{question}</h1>}
          <p className={over ? "dossier-description" : "dossier-lead"}>{t("lead")}</p>
        </div>
      </aside>

      <section className="stage">
        {over ? (
          <div className="summary">
            <ResultCard
              label={label}
              headline={!solved ? t("lost", { n: right }) : attempts.length === 1 ? t("flawless") : t("solvedIn", { n: attempts.length })}
              answer={`${t("theOrder")} ↓`}
              points={scoreOf(events, attempts, maxAttempts).points}
              stats={[
                {
                  label: shell("statTries"),
                  value: `${solved ? attempts.length : "X"}/${maxAttempts}`,
                  tone: solved ? "hit" : "miss",
                },
                { label: shell("statInPlace"), value: `${right}/${truth.length}` },
                { label: shell("statFound"), value: shell(solved ? "yes" : "no"), tone: solved ? "hit" : "miss" },
              ]}
              review={review}
            >
              {children}
            </ResultCard>
            <ol className="events">
              {chronological(events).map((event, i) => (
                <li key={event.id}>
                  <div className="event" data-state={last?.[i] === event.id ? "locked" : "miss"}>
                    <span className="event-letter">{i + 1}</span>
                    <span className="event-text">
                      <b>{event.name[locale]}</b>
                      <small>{event.place[locale]}</small>
                    </span>
                    <span className="event-year">{yearText(event)}</span>
                  </div>
                </li>
              ))}
            </ol>
            <figure className="life">
              <figcaption>
                <span className="eyebrow">{shell("onTheMap")}</span>
              </figcaption>
              {map}
            </figure>
          </div>
        ) : (
          <>
            <Plaque
              eyebrow={shell("plaqueOrder")}
              text={t("question")}
              as="h1"
              status={
                last && `${right ? t("feedback", { n: right }) : t("feedbackNone")} ${triesLeft === 1 ? t("lastTry") : t("triesLeft", { n: triesLeft })}`
              }
            />
            {map}
            <div className="slots-frame">
              <span className="eyebrow">{t("earliest")}</span>
              <ol className="slots">
                {order.map((id, i) => {
                  const state = locked[i] ? "locked" : id ? "placed" : i === nextFree ? "next" : "empty";
                  return (
                    <li key={i} data-state={state}>
                      <small>{i + 1}</small>
                      {id && !locked[i] ? (
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          aria-label={`${t("remove")}: ${byId.get(id)?.event.name[locale]}`}
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
              <span className="eyebrow">{t("latest")}</span>
            </div>

            <ul className="events">
              {events.map((event, i) => {
                const position = order.indexOf(event.id);
                const isLocked = locked.includes(event.id);
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="event"
                      data-state={isLocked ? "locked" : position >= 0 ? "placed" : undefined}
                      disabled={isLocked || (position === -1 && full)}
                      aria-pressed={position >= 0}
                      onClick={() => toggle(event.id)}
                    >
                      <span className="event-letter">{LETTERS[i]}</span>
                      <span className="event-text">
                        <b>{event.name[locale]}</b>
                        <small>{event.place[locale]}</small>
                      </span>
                      <span className="event-position">{position >= 0 ? position + 1 : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="controls action-bar">
              <p className="hint">{t(mouse ? "howToMouse" : "howTo")}</p>
              <button type="button" className="button" disabled={!full} onClick={check}>
                {t("check")}
              </button>
            </div>

            {attempts.length > 0 && (
              <ol className="ftl-history" aria-label={t("yourTries")}>
                {attempts.map((attempt, n) => (
                  <li key={n}>
                    <span className="ftl-n">{n + 1}</span>
                    <ol aria-label={attempt.map((id) => byId.get(id)?.letter).join(" ")}>
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
