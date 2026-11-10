"use client";

import { Modal } from "@/components/modal";
import { formatNumber, useLocale, useSiteT } from "@/lib/i18n";
import { openPanel, usePanel } from "@/lib/ui";

export type StatTile = { label: string; value: number | string };

type Props = {
  /** The rules, one short line each. */
  help: string[];
  /** Shown to newcomers until they close it once. */
  seenHelp: boolean;
  onSeenHelp: () => void;
  tiles: StatTile[];
  /** Finished puzzles; 0 shows the "nothing yet" note. */
  played: number;
};

/** A game's overlays: how to play (opened once for newcomers) and statistics. */
export function GamePanels({ help, seenHelp, onSeenHelp, tiles, played }: Props) {
  const locale = useLocale();
  const t = useSiteT();
  const panel = usePanel();
  const helpOpen = panel === "help" || !seenHelp;

  function closeHelp() {
    if (!seenHelp) onSeenHelp();
    openPanel(null);
  }

  return (
    <>
      <Modal open={helpOpen} onClose={closeHelp} title={t("help")} closeLabel={t("close")}>
        <ol className="help-list">
          {help.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <button type="button" className="button button-wide" onClick={closeHelp} autoFocus>
          {t("helpStart")}
        </button>
      </Modal>

      <Modal
        open={panel === "stats" && !helpOpen}
        onClose={() => openPanel(null)}
        title={t("stats")}
        closeLabel={t("close")}
      >
        <dl className="stat-tiles">
          {tiles.map((tile) => (
            <div key={tile.label}>
              <dd>{typeof tile.value === "number" ? formatNumber(tile.value, locale) : tile.value}</dd>
              <dt>{tile.label}</dt>
            </div>
          ))}
        </dl>
        {played === 0 && <p className="hint">{t("statsEmpty")}</p>}
      </Modal>
    </>
  );
}
