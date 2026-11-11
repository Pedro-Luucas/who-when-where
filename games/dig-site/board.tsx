"use client";

import { defineBoard } from "../platform/board";
import type { BoardProps } from "../platform/types";
import data from "./data";
import { definition } from "./definition";
import { DigSiteBoard } from "./game";
import { MESSAGES, type MessageKey } from "./messages";
import type { Dig } from "./rules";
import { shareText } from "./share";
import type { Site } from "./sites";
import { computeStats, type DayRecord } from "./store";

function Board({ puzzle, moves, onMove, tries, label, children }: BoardProps<Site, Dig>) {
  return (
    <DigSiteBoard site={puzzle} digs={moves} onDig={onMove} maxDigs={tries} label={label}>
      {children}
    </DigSiteBoard>
  );
}

export default defineBoard<Site, Dig, DayRecord, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  daily: (t) => ({
    kicker: t("kicker"),
    help: [t("help1"), t("help2"), t("help3"), t("help4"), t("help5")],
  }),
  share: ({ day, moves, url }) => shareText(day, moves, url),
  stats(save, today, { t, site }) {
    const stats = computeStats(save, today);
    return {
      played: stats.played,
      tiles: [
        { label: site("statPlayed"), value: stats.played },
        { label: t("statFound"), value: `${stats.foundRate}%` },
        { label: t("statAverage"), value: stats.averageDigs },
        { label: site("statStreak"), value: stats.streak },
        { label: site("statLongest"), value: stats.longestStreak },
      ],
    };
  },
});
