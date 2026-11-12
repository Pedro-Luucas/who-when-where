"use client";

import { defineBoard } from "../platform/board";
import type { BoardProps } from "../platform/types";
import data from "./data";
import { definition } from "./definition";
import { WhoWhenWhereBoard } from "./game";
import { MESSAGES, type MessageKey } from "./messages";
import type { Person } from "./people";
import type { Guess } from "./rules";
import { shareText } from "./share";
import { computeStats, type DayRecord } from "./store";

function Board({ puzzle, moves, onMove, onMoves, year, label, children }: BoardProps<Person, Guess>) {
  return (
    <WhoWhenWhereBoard person={puzzle} guesses={moves} onGuess={onMove} onGuesses={onMoves} maxYear={year} label={label}>
      {children}
    </WhoWhenWhereBoard>
  );
}

export default defineBoard<Person, Guess, DayRecord, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  daily: (t) => ({
    kicker: t("todaysMind"),
    help: [t("help1"), t("help2"), t("help3"), t("help4"), t("help5")],
    nextLabel: t("nextIn"),
  }),
  share: ({ day, moves, locale, url }) => shareText(day, moves, locale, url),
  stats(save, today, { t, site }) {
    const stats = computeStats(save, today);
    return {
      played: stats.played,
      tiles: [
        { label: site("statPlayed"), value: stats.played },
        { label: t("statAverage"), value: stats.average },
        { label: t("statBest"), value: stats.best },
        { label: site("statStreak"), value: stats.streak },
        { label: site("statLongest"), value: stats.longestStreak },
      ],
    };
  },
});
