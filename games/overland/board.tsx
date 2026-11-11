"use client";

import { defineBoard } from "../platform/board";
import type { BoardProps } from "../platform/types";
import data from "./data";
import { definition } from "./definition";
import { OverlandBoard } from "./game";
import { MESSAGES, type MessageKey } from "./messages";
import type { Puzzle } from "./rules";
import { shareText } from "./share";
import { computeStats, type DayRecord } from "./store";

function Board({ puzzle, moves, onMove, tries, label, children }: BoardProps<Puzzle, string>) {
  return (
    <OverlandBoard puzzle={puzzle} guesses={moves} onGuess={onMove} spare={tries} label={label}>
      {children}
    </OverlandBoard>
  );
}

export default defineBoard<Puzzle, string, DayRecord, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  daily: (t) => ({
    kicker: t("kicker"),
    help: [t("help1"), t("help2"), t("help3"), t("help4"), t("help5")],
  }),
  share: ({ day, puzzle, moves, url }) => shareText(day, puzzle, moves, url),
  stats(save, today, { t, site }) {
    const stats = computeStats(save, today);
    return {
      played: stats.played,
      tiles: [
        { label: site("statPlayed"), value: stats.played },
        { label: t("statArrived"), value: `${stats.arrivedRate}%` },
        { label: t("statShortest"), value: stats.shortest },
        { label: site("statStreak"), value: stats.streak },
        { label: site("statLongest"), value: stats.longestStreak },
      ],
    };
  },
});
