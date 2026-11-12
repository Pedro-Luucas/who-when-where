"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { familyStyle, useGameFrame } from "@/games/platform/frame";
import { useShellT } from "@/lib/shell-messages";
import { openPanel } from "@/lib/ui";

// The game screen's HUD bar, after geocore's: the way back to the catalogue
// and the game's name on the left; the round, the tries as pips and a few
// live numbers in the middle; Skip, Give up, How to play and Statistics on the
// right. Every game renders one at the top of its board.

/** How one try went, for the pips: right, close, wrong, skipped — or still to come. */
export type Pip = "hit" | "near" | "miss" | "skip" | "current" | "todo";

export type HudStat = { icon: IconName; label: string; value: React.ReactNode };

type Props = {
  /** The round or try being played: "2 / 6". */
  step?: { n: number; total: number; kind: "round" | "try" };
  /** One pip per try or round. Their meaning is also in `step` and the game's own list. */
  pips?: Pip[];
  stats?: HudStat[];
  /** Passes this try (Wayfarer). */
  onSkip?: () => void;
  /** Ends the puzzle now, revealing the answer. Asks once more before it does. */
  onGiveUp?: () => void;
  /** The puzzle is finished: no more skipping or giving up. */
  over?: boolean;
};

export function Hud({ step, pips, stats = [], onSkip, onGiveUp, over }: Props) {
  const t = useShellT();
  const frame = useGameFrame();
  // The game's own pages (daily, practice) lead back to the catalogue and explain the rules.
  const home = !!frame && (frame.daily || !!frame.practice);

  return (
    <div className="hud" role="group" aria-label={t("hudLabel")} style={familyStyle(frame?.family)}>
      <div className="hud-side">
        {home && (
          <Link href="/play" className="hud-key hud-back">
            <Icon name="back" size={16} />
            <span>{t("allGames")}</span>
          </Link>
        )}
        {frame && (
          <span className="hud-game">
            <i aria-hidden="true" />
            {frame.title}
            {frame.practice && <small className="hud-mode">{t("modePractice")}</small>}
          </span>
        )}
      </div>

      <div className="hud-center">
        {step && (
          <span
            className="hud-round"
            aria-label={t(step.kind === "round" ? "roundLabel" : "tryLabel", { n: step.n, total: step.total })}
          >
            {t("round", { n: step.n, total: step.total })}
          </span>
        )}
        {pips && (
          <ol className="hud-pips" aria-hidden="true">
            {pips.map((pip, i) => (
              <li key={i} data-state={pip} />
            ))}
          </ol>
        )}
        {stats.map((stat) => (
          <span key={stat.label} className="hud-stat" title={stat.label}>
            <Icon name={stat.icon} size={15} />
            <span className="sr-only">{stat.label}: </span>
            {stat.value}
          </span>
        ))}
      </div>

      <div className="hud-side hud-end">
        {onSkip && !over && (
          <button type="button" className="hud-key" onClick={onSkip}>
            <Icon name="skip" size={15} />
            <span>{t("skip")}</span>
          </button>
        )}
        {onGiveUp && !over && <GiveUp onGiveUp={onGiveUp} />}
        {home && (
          <button
            type="button"
            className="hud-key hud-icon"
            onClick={() => openPanel("help")}
            aria-label={t("help")}
            title={t("help")}
          >
            <Icon name="help" size={17} />
          </button>
        )}
        {frame?.daily && (
          <>
            <button
              type="button"
              className="hud-key hud-icon"
              onClick={() => openPanel("stats")}
              aria-label={t("stats")}
              title={t("stats")}
            >
              <Icon name="chart" size={17} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** "Give up", then "Sure? Give up" for a few seconds: one stray tap never ends a puzzle. */
function GiveUp({ onGiveUp }: { onGiveUp: () => void }) {
  const t = useShellT();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);

  return (
    <button
      type="button"
      className="hud-key"
      data-danger={asking ? "" : undefined}
      onClick={() => {
        if (asking) {
          setAsking(false);
          onGiveUp();
        } else setAsking(true);
      }}
    >
      <Icon name="flag" size={15} />
      <span aria-live="polite">{t(asking ? "giveUpConfirm" : "giveUp")}</span>
    </button>
  );
}
