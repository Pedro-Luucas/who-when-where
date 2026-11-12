"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { SettingsDialog } from "@/components/settings-button";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { Dialog } from "@/components/ui/dialog";
import { familyStyle, useGameFrame } from "@/games/platform/frame";
import { setSound, tap } from "@/lib/fx";
import { useIsMobile } from "@/lib/media";
import { usePrefs } from "@/lib/prefs";
import { useShellT } from "@/lib/shell-messages";
import { openPanel } from "@/lib/ui";

// The game screen's HUD bar, after geocore's: the way back to the catalogue
// and the game's name on the left; the round, the tries as pips and a few
// live numbers in the middle; Skip, Give up, sound, How to play, Statistics
// and the keyboard sheet on the right. Every game renders one at the top of
// its board.
//
// Phones get a HUD of their own (PhoneHud): one row across the top of a
// full-screen game — back, the round with its pips and numbers, and a menu
// key. Skip, Give up, sound, How to play, Statistics and Settings move into
// the sheet that key opens, so the top of the screen stays the game's.
//
// Both answer the same keys (useGameKeys): ? the shortcut sheet, H How to
// play, M sound, S Skip, G Give up (twice). A board's own keys (1–4, A–F,
// Enter…) go first: a key a board took is not the HUD's.

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
  const frame = useGameFrame();
  const home = !!frame && (frame.daily || !!frame.practice);
  const giveUp = useGiveUpAsk(props.onGiveUp && !props.over ? props.onGiveUp : undefined);
  const [keys, setKeys] = useState(false);
  const [prefs] = usePrefs();

  useGameKeys((key) => {
    switch (key.toLowerCase()) {
      case "?":
        setKeys(true);
        return true;
      case "h":
        if (!home) return false;
        openPanel("help");
        return true;
      case "m":
        setSound(!prefs.sound);
        return true;
      case "s":
        if (!props.onSkip || props.over) return false;
        props.onSkip();
        return true;
      case "g":
        if (!giveUp.available) return false;
        giveUp.press();
        return true;
    }
    return false;
  });

  return (
    <>
      {phone ? (
        <PhoneHud {...props} giveUp={giveUp} onKeys={() => setKeys(true)} />
      ) : (
        <WideHud {...props} giveUp={giveUp} onKeys={() => setKeys(true)} />
      )}
      <ShortcutsDialog open={keys} onClose={() => setKeys(false)} />
    </>
  );
}

type GiveUpAsk = { available: boolean; asking: boolean; press: () => void; cancel: () => void };

/** "Give up", then "Sure? Give up" for a few seconds: one stray tap (or key) never ends a puzzle. */
function useGiveUpAsk(onGiveUp: (() => void) | undefined): GiveUpAsk {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);
  return {
    available: !!onGiveUp,
    asking: asking && !!onGiveUp,
    press() {
      if (!onGiveUp) return;
      if (asking) {
        setAsking(false);
        onGiveUp();
      } else {
        tap("firm");
        setAsking(true);
      }
    },
    cancel: () => setAsking(false),
  };
}

/**
 * The game screen's own keys, after the board's: a key the board already took
 * (preventDefault) is left alone, and nothing is heard while the player types
 * in a field or a dialog is open.
 */
function useGameKeys(onKey: (key: string) => boolean): void {
  const handle = useEffectEvent(onKey);
  useEffect(() => {
    function listen(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], dialog[open]")) return;
      if (document.querySelector("dialog[open]")) return;
      // The boards listen on window too, and may be called after this: let them go first.
      setTimeout(() => {
        if (!event.defaultPrevented) handle(event.key);
      });
    }
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);
}

/** The sound on or off, from the HUD: the same switch as in Settings. */
function SoundKey({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const t = useShellT();
  const [prefs] = usePrefs();
  const on = prefs.sound;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={withLabel ? undefined : t("soundToggle")}
      title={`${t(on ? "soundOn" : "soundOff")} (M)`}
      onClick={() => setSound(!on)}
      data-off={on ? undefined : ""}
    >
      <Icon key={on ? "on" : "off"} name={on ? "sound" : "muted"} size={withLabel ? 20 : 17} className="hud-sound-icon" />
      {withLabel && <span>{t(on ? "soundOn" : "soundOff")}</span>}
    </button>
  );
}

type KeyRow = [keys: string[], what: string];

/** The keys of the game screen, in a sheet (? or the keyboard key in the HUD). */
function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useShellT();
  const groups: [string, KeyRow[]][] = [
    [
      t("kGeneral"),
      [
        [["?"], t("kShortcuts")],
        [["H"], t("kHelp")],
        [["M"], t("kSound")],
        [["S"], t("kSkip")],
        [["G"], t("kGiveUp")],
        [["/"], t("kSearch")],
        [["Esc"], t("kClose")],
      ],
    ],
    [
      t("kInGame"),
      [
        [["1", "2", "3", "4"], t("kChoose")],
        [["A", "B", "C", "…"], t("kPlace")],
        [["⌫"], t("kUndo")],
        [["Enter"], t("kNext")],
        [["↑", "↓"], t("kMatches")],
        [["←", "↑", "→", "↓"], t("kMap")],
      ],
    ],
  ];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("shortcuts")}
      description={t("shortcutsLead")}
      closeLabel={t("close")}
      className="shortcuts"
    >
      {groups.map(([heading, rows]) => (
        <section key={heading} className="shortcuts-group">
          <h3>{heading}</h3>
          <dl>
            {rows.map(([keys, what]) => (
              <div key={what}>
                <dt>
                  {keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Dialog>
  );
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
          {/* Keyed by value: a number that changes pops. */}
          <span key={String(stat.value)} className="hud-stat-value">
            {stat.value}
          </span>
        </span>
      ))}
    </div>
  );
}

type HudParts = Props & { giveUp: GiveUpAsk; onKeys: () => void };

function PhoneHud({ step, pips, stats, onSkip, over, giveUp }: HudParts) {
  const t = useShellT();
  const frame = useGameFrame();
  const home = !!frame && (frame.daily || !!frame.practice);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const canSkip = !!onSkip && !over;

  function close() {
    setMenu(false);
    giveUp.cancel();
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
          {giveUp.available && (
            <li>
              <button
                type="button"
                data-danger={giveUp.asking ? "" : undefined}
                onClick={() => {
                  if (giveUp.asking) setMenu(false);
                  giveUp.press();
                }}
              >
                <Icon name="flag" size={20} />
                <span aria-live="polite">{t(giveUp.asking ? "giveUpConfirm" : "giveUp")}</span>
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
            <SoundKey withLabel />
          </li>
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

function WideHud({ step, pips, stats = [], onSkip, over, giveUp, onKeys }: HudParts) {
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
          <button type="button" className="hud-key" onClick={onSkip} title={`${t("skip")} (S)`}>
            <Icon name="skip" size={15} />
            <span>{t("skip")}</span>
          </button>
        )}
        {giveUp.available && (
          <button
            type="button"
            className="hud-key"
            data-danger={giveUp.asking ? "" : undefined}
            title={`${t("giveUp")} (G)`}
            onClick={giveUp.press}
          >
            <Icon name="flag" size={15} />
            <span aria-live="polite">{t(giveUp.asking ? "giveUpConfirm" : "giveUp")}</span>
          </button>
        )}
        <SoundKey className="hud-key hud-icon hud-sound" />
        {home && (
          <button
            type="button"
            className="hud-key hud-icon"
            onClick={() => openPanel("help")}
            aria-label={t("help")}
            title={`${t("help")} (H)`}
          >
            <Icon name="help" size={17} />
          </button>
        )}
        <button
          type="button"
          className="hud-key hud-icon hud-keys"
          onClick={onKeys}
          aria-label={t("shortcuts")}
          title={`${t("shortcuts")} (?)`}
        >
          <Icon name="keyboard" size={17} />
        </button>
        {frame?.daily && (
          <button
            type="button"
            className="hud-key hud-icon"
            onClick={() => openPanel("stats")}
            aria-label={t("stats")}
            title={t("stats")}
          >
            <Icon name="chart" size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
