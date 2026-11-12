"use client";

import { formatYear, translator, useLocale, type Locale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import type { HistoryEvent } from "../first-to-last/events";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { PickBoard, type PickRound } from "../engines/pick";
import { pickScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { LIVES, answersOf, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

function EventCard({ event, label, year, locale }: { event: HistoryEvent; label: string; year: string | null; locale: Locale }) {
  return (
    <div className="event-card" data-known={year !== null ? "" : undefined}>
      <small className="eyebrow">{label}</small>
      <b>{event.name[locale]}</b>
      <span className="event-card-place">{event.place[locale]}</span>
      <span className="event-card-year">{year ?? "?"}</span>
    </div>
  );
}

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const answers = answersOf(puzzle);
  const yearOf = (event: HistoryEvent) => `${event.circa ? `${t("circa")} ` : ""}${formatYear(event.year, locale)}`;

  const rounds: PickRound[] = puzzle.slice(1).map((event, i) => {
    const before = puzzle[i];
    return {
      key: `${before.id}>${event.id}`,
      eyebrow: t("eyebrow"),
      prompt: t("prompt", { event: event.name[locale] }),
      scene: (answered) => (
        <div className="event-pair">
          <EventCard event={before} label={t("known")} year={yearOf(before)} locale={locale} />
          <EventCard event={event} label={t("next")} year={answered ? yearOf(event) : null} locale={locale} />
        </div>
      ),
      options: [
        { id: "earlier", label: `↑ ${t("earlier")}` },
        { id: "later", label: `${t("later")} ↓` },
      ],
      answer: answers[i],
      reveal: t("reveal", { a: event.name[locale], ya: yearOf(event), b: before.name[locale], yb: yearOf(before) }),
      review: event.name[locale],
    };
  });

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      lives={LIVES}
      layout="binary"
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(pickScore(answers, moves, LIVES).points))}
      answer={(tally) => t("answer", { n: tally.correct, total: rounds.length })}
    >
      {children}
    </PickBoard>
  );
}

export default defineSetBoard<Puzzle, string, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const answers = answersOf(puzzle);
    return shareLines(definition.title, day, pickScore(answers, moves, LIVES).points, pickSquares(answers, moves, LIVES), url);
  },
});
