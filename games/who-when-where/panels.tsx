"use client";

import { GamePanels } from "@/components/game-panels";
import { useSiteT } from "@/lib/i18n";
import { useGameT } from "./messages";
import { computeStats, useSave } from "./store";

/** How to play and statistics for Who When Where. */
export function Panels({ day }: { day: number }) {
  const { t } = useGameT();
  const site = useSiteT();
  const [save, setSave] = useSave();
  const stats = computeStats(save, day);

  return (
    <GamePanels
      game="who-when-where"
      help={[t("help1"), t("help2"), t("help3"), t("help4"), t("help5")]}
      seenHelp={save.seenHelp}
      onSeenHelp={() => setSave((previous) => ({ ...previous, seenHelp: true }))}
      played={stats.played}
      tiles={[
        { label: site("statPlayed"), value: stats.played },
        { label: t("statAverage"), value: stats.average },
        { label: t("statBest"), value: stats.best },
        { label: site("statStreak"), value: stats.streak },
        { label: site("statLongest"), value: stats.longestStreak },
      ]}
    />
  );
}
