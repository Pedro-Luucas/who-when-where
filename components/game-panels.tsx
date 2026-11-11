"use client";

import { useEffect } from "react";
import { Modal } from "@/components/modal";
import { useDailyResults, type DailyResult } from "@/games/results";
import type { StatTile } from "@/games/platform/types";
import type { GameSlug } from "@/games/registry";
import { formatNumber, useLocale, useSiteT } from "@/lib/i18n";
import { openPanel, usePanel } from "@/lib/ui";

export type { StatTile };

type Props = {
  /** The game these panels belong to: its finished days make the chart. */
  game: GameSlug;
  /** The rules, one short line each. */
  help: string[];
  /** Shown to newcomers until they close it once. */
  seenHelp: boolean;
  onSeenHelp: () => void;
  tiles: StatTile[];
  /** Finished puzzles; 0 shows the "nothing yet" note. */
  played: number;
};

type Bar = { label: string; count: number };

// Points bands, for the games whose result is not a number of tries.
const BANDS = [
  { label: "900+", from: 900 },
  { label: "650+", from: 650 },
  { label: "400+", from: 400 },
  { label: "<400", from: 0 },
];

/**
 * How the player's finished puzzles went: one bar per number of tries
 * ("1"…"6", then "×" for the ones that got away) where the result reads
 * "3/6", and one bar per band of points otherwise.
 */
function distributionOf(results: DailyResult[]): Bar[] {
  const tries = results.map((result) => /^(\d+|X)\/(\d+)$/.exec(result.detail));
  // Overland allows a different number of guesses each day: bands suit it better.
  const allowed = new Set(tries.map((match) => match?.[2]));
  if (allowed.size !== 1 || allowed.has(undefined)) {
    return BANDS.map((band, i) => ({
      label: band.label,
      count: results.filter((result) => result.points >= band.from && (i === 0 || result.points < BANDS[i - 1].from))
        .length,
    }));
  }
  const most = Number([...allowed][0]);
  const count = (used: string) => tries.filter((match) => match?.[1] === used).length;
  return [
    ...Array.from({ length: most }, (_, i) => ({ label: String(i + 1), count: count(String(i + 1)) })),
    { label: "×", count: count("X") },
  ];
}

/** A game's overlays: how to play (opened once for newcomers) and statistics. */
export function GamePanels({ game, help, seenHelp, onSeenHelp, tiles, played }: Props) {
  const locale = useLocale();
  const t = useSiteT();
  const panel = usePanel();
  const results = useDailyResults();
  const helpOpen = panel === "help" || !seenHelp;

  // The open panel is module state: leaving the game must not carry it to the next page.
  useEffect(() => () => openPanel(null), []);

  function closeHelp() {
    if (!seenHelp) onSeenHelp();
    openPanel(null);
  }

  const bars = distributionOf(results.filter((result) => result.game === game));
  const tallest = Math.max(1, ...bars.map((bar) => bar.count));

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
        {played === 0 ? (
          <p className="hint">{t("statsEmpty")}</p>
        ) : (
          <figure className="distribution">
            <figcaption className="eyebrow">{t("statsSpread")}</figcaption>
            <ol>
              {bars.map((bar) => (
                <li key={bar.label}>
                  <span>{bar.label}</span>
                  <i style={{ width: `${(bar.count / tallest) * 100}%` }} data-empty={bar.count ? undefined : ""} />
                  <b>{bar.count}</b>
                </li>
              ))}
            </ol>
          </figure>
        )}
      </Modal>
    </>
  );
}
