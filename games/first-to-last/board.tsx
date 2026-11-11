"use client";

import { defineBoard } from "../platform/board";
import type { BoardProps } from "../platform/types";
import data from "./data";
import { definition } from "./definition";
import type { HistoryEvent } from "./events";
import { FirstToLastBoard } from "./game";
import { MESSAGES, type MessageKey } from "./messages";
import { truthOf, type Attempt } from "./rules";
import { shareText } from "./share";
import { computeStats, type DayRecord } from "./store";

function Board({ puzzle, moves, onMove, onMoves, tries, label, children }: BoardProps<HistoryEvent[], Attempt>) {
  return (
    <FirstToLastBoard events={puzzle} attempts={moves} onAttempt={onMove} onAttempts={onMoves} maxAttempts={tries} label={label}>
      {children}
    </FirstToLastBoard>
  );
}

export default defineBoard<HistoryEvent[], Attempt, DayRecord, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  daily: (t) => ({
    kicker: t("kicker"),
    help: [t("help1"), t("help2"), t("help3"), t("help4"), t("help5")],
  }),
  share: ({ day, puzzle, moves, url }) => shareText(day, moves, truthOf(puzzle), url),
  stats(save, today, { t, site }) {
    const stats = computeStats(save, today);
    return {
      played: stats.played,
      tiles: [
        { label: site("statPlayed"), value: stats.played },
        { label: t("statSolved"), value: `${stats.solvedRate}%` },
        { label: t("statFlawless"), value: stats.flawless },
        { label: site("statStreak"), value: stats.streak },
        { label: site("statLongest"), value: stats.longestStreak },
      ],
    };
  },
});
