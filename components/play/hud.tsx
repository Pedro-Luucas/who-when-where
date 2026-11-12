"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsDialog } from "@/components/settings-button";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { Dialog } from "@/components/ui/dialog";
import { familyStyle, useGameFrame } from "@/games/platform/frame";
import { tap } from "@/lib/fx";
import { useIsMobile } from "@/lib/media";
import { useShellT } from "@/lib/shell-messages";
import { openPanel } from "@/lib/ui";

// The game screen's HUD bar, after geocore's: the way back to the catalogue
// and the game's name on the left; the round, the tries as pips and a few
// live numbers in the middle; Skip, Give up, How to play and Statistics on the
// right. Every game renders one at the top of its board.
//
// Phones get a HUD of their own (PhoneHud): one row across the top of a
// full-screen game — back, the round with its pips and numbers, and a menu
// key. Skip, Give up, How to play, Statistics and Settings move into the
// sheet that key opens, so the top of the screen stays the game's.

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

export function Hud(props: Props) {
  const phone = useIsMobile();
  return phone ? <PhoneHud {...props} /> : <WideHud {...props} />;
}

/** The round, the pips and the live numbers: the middle of both HUDs. */
function HudCenter({ step, pips, stats = [] }: Pick<Props, "step" | "pips" | "stats">) {
  const t = useShellT();
  return (
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
  );
}

function PhoneHud({ step, pips, stats, onSkip, onGiveUp, over }: Props) {
  const t = useShellT();
  const frame = useGameFrame();
  const home = !!frame && (frame.daily || !!frame.practice);
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState(false);
  const [settings, setSettings] = useState(false);
  const canSkip = !!onSkip && !over;
  const canGiveUp = !!onGiveUp && !over;

  function close() {
    setMenu(false);
    setAsking(false);
  }
  /** Runs a menu action once the sheet is out of the way. */
  function pick(action: () => void) {
    close();
    tap();
    action();
  }

  return (
    <div className="hud hud-phone" role="group" aria-label={t("hudLabel")} style={familyStyle(frame?.family)}>
      {home ? (
        <Link href="/play" className="hud-key hud-icon hud-back" aria-label={t("allGames")}>
          <Icon name="back" size={20} />
        </Link>
      ) : (
        <span className="hud-fam" aria-hidden="true" />
      )}

      <HudCenter step={step} pips={pips} stats={stats} />

      <button
        type="button"
        className="hud-key hud-icon hud-menu"
        aria-haspopup="dialog"
        aria-label={t("gameMenu")}
        onClick={() => setMenu(true)}
      >
        <Icon name="more" size={20} />
      </button>

      <Dialog
        open={menu}
        onClose={close}
        title={frame?.title ?? t("gameMenu")}
        description={frame?.practice ? t("modePractice") : t("gameMenuLead")}
        closeLabel={t("close")}
        className="game-menu"
      >
        <ul className="sheet-list">
          {canSkip && (
            <li>
              <button type="button" onClick={() => pick(onSkip)}>
                <Icon name="skip" size={20} />
                <span>{t("skip")}</span>
              </button>
            </li>
          )}
          {canGiveUp && (
            <li>
              <button
                type="button"
                data-danger={asking ? "" : undefined}
                onClick={() => (asking ? pick(onGiveUp) : (tap("firm"), setAsking(true)))}
              >
                <Icon name="flag" size={20} />
                <span aria-live="polite">{t(asking ? "giveUpConfirm" : "giveUp")}</span>
              </button>
            </li>
          )}
          {home && (
            <li>
              <button type="button" onClick={() => pick(() => openPanel("help"))}>
                <Icon name="help" size={20} />
                <span>{t("help")}</span>
              </button>
            </li>
          )}
          {frame?.daily && (
            <li>
              <button type="button" onClick={() => pick(() => openPanel("stats"))}>
                <Icon name="chart" size={20} />
                <span>{t("stats")}</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" onClick={() => pick(() => setSettings(true))}>
              <Icon name="sliders" size={20} />
              <span>{t("settings")}</span>
            </button>
          </li>
          {home && (
            <li>
              <Link href="/play" onClick={close}>
                <Icon name="play" size={20} />
                <span>{t("allGames")}</span>
                <Icon name="chevron" size={16} className="sheet-list-end" />
              </Link>
            </li>
          )}
        </ul>
      </Dialog>
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

function WideHud({ step, pips, stats = [], onSkip, onGiveUp, over }: Props) {
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

      <HudCenter step={step} pips={pips} stats={stats} />

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
