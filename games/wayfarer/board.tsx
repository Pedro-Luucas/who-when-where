"use client";

import { defineBoard } from "../platform/board";
import type { BoardProps } from "../platform/types";
import data from "./data";
import { definition } from "./definition";
import { WayfarerBoard } from "./game";
import type { Journey } from "./journeys";
import { MESSAGES, type MessageKey } from "./messages";
import type { Guess } from "./rules";
import { shareText } from "./share";
import { computeStats, type DayRecord } from "./store";

function Board({ puzzle, moves, onMove, onMoves, tries, label, children }: BoardProps<Journey, Guess>) {
  return (
    <WayfarerBoard journey={puzzle} guesses={moves} onGuess={onMove} onGuesses={onMoves} maxGuesses={tries} label={label}>
      {children}
    </WayfarerBoard>
  );
}

export default defineBoard<Journey, Guess, DayRecord, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  daily: (t) => ({
    kicker: t("kicker"),
    help: [t("help1"), t("help2"), t("help3"), t("help4"), t("help5")],
  }),
  share: ({ day, puzzle, moves, url }) => shareText(day, puzzle.id, moves, url),
  stats(save, today, { t, site }) {
    const stats = computeStats(save, today);
    return {
      played: stats.played,
      tiles: [
        { label: site("statPlayed"), value: stats.played },
        { label: t("statSolved"), value: `${stats.solvedRate}%` },
        { label: t("statAverage"), value: stats.averageTries },
        { label: site("statStreak"), value: stats.streak },
        { label: site("statLongest"), value: stats.longestStreak },
      ],
    };
  },
});
