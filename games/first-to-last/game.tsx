"use client";

import { useState } from "react";
import { Daily } from "@/components/daily";
import { GamePanels } from "@/components/game-panels";
import { ResultActions } from "@/components/result-footer";
import { WorldMap, useMapLabels, type MapMarker, type MapRoute } from "@/components/world-map";
import { formatYear, useSiteT } from "@/lib/i18n";
import { chronological, type HistoryEvent } from "./events";
import { useGameT } from "./messages";
import { MAX_ATTEMPTS, inPlace, isOver, isSolved, truthOf, type Attempt } from "./rules";
import { shareText } from "./share";
import { computeStats, puzzleOf, useSave } from "./store";

const LETTERS = "ABCDEFGH";

export function FirstToLast() {
  // Keyed by day: at midnight the next puzzle starts from a clean slate.
  return <Daily>{(day) => <Play key={day} day={day} />}</Daily>;
}

function Play({ day }: { day: number }) {
  const [save, setSave] = useSave();
  const { t } = useGameT();
  const siteT = useSiteT();

  const { events, attempts } = puzzleOf(save, day);
  const stats = computeStats(save, day);

  function attempt(order: Attempt) {
    setSave((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [day]: {
          ids: events.map((event) => event.id),
          attempts: [...(previous.days[day]?.attempts ?? []), order],
        },
      },
    }));
  }

  return (
    <>
      <FirstToLastBoard
        events={events}
        attempts={attempts}
        onAttempt={attempt}
        label={`${siteT("puzzleNo", { n: day })} — ${t("kicker")}`}
      >
        <ResultActions
          path="/first-to-last"
          shareText={(url) => shareText(day, attempts, truthOf(events), url)}
        />
      </FirstToLastBoard>
      <GamePanels
        game="first-to-last"
        help={[t("help1"), t("help2"), t("help3"), t("help4"), t("help5")]}
        seenHelp={save.seenHelp}
        onSeenHelp={() => setSave((previous) => ({ ...previous, seenHelp: true }))}
        played={stats.played}
        tiles={[
          { label: siteT("statPlayed"), value: stats.played },
          { label: t("statSolved"), value: `${stats.solvedRate}%` },
          { label: t("statFlawless"), value: stats.flawless },
          { label: siteT("statStreak"), value: stats.streak },
          { label: siteT("statLongest"), value: stats.longestStreak },
        ]}
      />
    </>
  );
}

type BoardProps = {
  /** The puzzle's events, in the order they are lettered. */
  events: HistoryEvent[];
  attempts: Attempt[];
  onAttempt: (order: Attempt) => void;
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
  maxAttempts = MAX_ATTEMPTS,
  label,
  children,
}: BoardProps) {
  const { locale, t } = useGameT();
  const mapLabels = useMapLabels();

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

  return (
    <main className="game" data-game="first-to-last" data-summary={over ? "" : undefined}>
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <h1 className="dossier-name">
            {t("question")
              .split("*")
              .map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
          </h1>
          <p className="dossier-description">{t("lead")}</p>
        </div>

        <ol className="meter" aria-label={`${attempts.length}/${maxAttempts}`}>
          {Array.from({ length: maxAttempts }, (_, i) => {
            const attempt = attempts[i];
            const state = !attempt
              ? i === attempts.length && !over
                ? "current"
                : "todo"
              : inPlace(attempt, truth) === truth.length
                ? "hit"
                : "miss";
            return <li key={i} data-state={state} />;
          })}
        </ol>
      </aside>

      <section className="stage">
        {over && (
          <div className="result-head" role="status">
            <div className="stamp" data-lost={solved ? undefined : ""}>
              <strong>
                {solved ? attempts.length : "×"}/{maxAttempts}
              </strong>
              <span>{t("tries")}</span>
            </div>
            <div className="verdict-text">
              <p className="verdict-headline">
                {!solved
                  ? t("lost", { n: right })
                  : attempts.length === 1
                    ? t("flawless")
                    : t("solvedIn", { n: attempts.length })}
              </p>
              <p className="verdict-answer">{t("theOrder")} ↓</p>
            </div>
          </div>
        )}

        <WorldMap
          markers={markers}
          routes={routes}
          focus={events}
          labels={mapLabels}
          ariaLabel={t("mapAria")}
        />

        {over ? (
          <>
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
            <div className="summary">{children}</div>
          </>
        ) : (
          <>
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

            <div className="controls">
              <p className="hint" role="status">
                {last
                  ? `${right ? t("feedback", { n: right }) : t("feedbackNone")} ${
                      triesLeft === 1 ? t("lastTry") : t("triesLeft", { n: triesLeft })
                    }`
                  : t("howTo")}
              </p>
              <button type="button" className="button" disabled={!full} onClick={check}>
                {t("check")}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
