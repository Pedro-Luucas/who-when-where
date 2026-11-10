"use client";

import { Modal } from "@/components/modal";
import { formatNumber, useSiteT } from "@/lib/i18n";
import { openPanel, usePanel } from "@/lib/ui";
import { useGameT } from "./messages";
import { computeStats, useSave } from "./store";

/** The game's overlays: how-to-play (shown once to newcomers) and statistics. */
export function Panels({ day }: { day: number }) {
  const { locale, t } = useGameT();
  const site = useSiteT();
  const panel = usePanel();
  const [save, setSave] = useSave();

  const helpOpen = panel === "help" || !save.seenHelp;
  const stats = computeStats(save, day);

  function closeHelp() {
    if (!save.seenHelp) setSave((previous) => ({ ...previous, seenHelp: true }));
    openPanel(null);
  }

  const tiles = [
    { label: t("statPlayed"), value: stats.played },
    { label: t("statAverage"), value: stats.average },
    { label: t("statBest"), value: stats.best },
    { label: t("statStreak"), value: stats.streak },
    { label: t("statLongest"), value: stats.longestStreak },
  ];

  return (
    <>
      <Modal open={helpOpen} onClose={closeHelp} title={t("helpTitle")} closeLabel={site("close")}>
        <ol className="help-list">
          <li>{t("help1")}</li>
          <li>{t("help2")}</li>
          <li>{t("help3")}</li>
          <li>{t("help4")}</li>
          <li>{t("help5")}</li>
        </ol>
        <button type="button" className="button button-wide" onClick={closeHelp} autoFocus>
          {t("helpStart")}
        </button>
      </Modal>

      <Modal
        open={panel === "stats" && !helpOpen}
        onClose={() => openPanel(null)}
        title={t("statsTitle")}
        closeLabel={site("close")}
      >
        <dl className="stat-tiles">
          {tiles.map((tile) => (
            <div key={tile.label}>
              <dd>{formatNumber(tile.value, locale)}</dd>
              <dt>{tile.label}</dt>
            </div>
          ))}
        </dl>
        {stats.played === 0 && <p className="hint">{t("statsEmpty")}</p>}
      </Modal>
    </>
  );
}
