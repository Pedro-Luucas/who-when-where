"use client";

import { useLayoutEffect } from "react";
import { cue } from "@/lib/fx";
import { useSiteT } from "@/lib/i18n";
import { THEMES, applyTheme, getPrefs, usePrefs, type Prefs } from "@/lib/prefs";
import { Segmented } from "./controls";
import { LocaleToggle } from "./locale-toggle";
import { Modal } from "./modal";

type Switch = "sound" | "haptics" | "effects";
const SWITCHES: Switch[] = ["sound", "haptics", "effects"];

/**
 * Keeps the page's theme in step with the player's choice. The script in
 * <head> has already put the theme on the page; this follows later changes
 * (and puts it back after React's remount in development). Read from the
 * device, not from `prefs`: while the page hydrates, `prefs` still holds the
 * defaults. Mounted once, in the root layout.
 */
export function ThemeSync() {
  const [prefs] = usePrefs();
  useLayoutEffect(() => applyTheme(getPrefs().theme), [prefs.theme]);
  return null;
}

/** The settings: theme, language, sound, vibration, confetti. Opened from the account menu. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useSiteT();
  const [prefs, setPrefs] = usePrefs();

  function flip(name: Switch, on: boolean) {
    setPrefs({ [name]: on } as Partial<Prefs>);
    // Let the player hear (or feel) what they have just turned on.
    if (on && name !== "effects") cue("move");
  }

  return (
    <Modal open={open} onClose={onClose} title={t("settings")} closeLabel={t("close")}>
      <ul className="settings">
        <li>
          <span>{t("theme")}</span>
          <Segmented
            label={t("theme")}
            options={THEMES.map((theme) => ({ value: theme, label: t(`theme_${theme}`) }))}
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
          />
        </li>
        <li>
          <span>{t("language")}</span>
          <LocaleToggle />
        </li>
        {SWITCHES.map((name) => (
          <li key={name}>
            <span>{t(name)}</span>
            <Segmented
              label={t(name)}
              options={[
                { value: "on", label: t("on") },
                { value: "off", label: t("off") },
              ]}
              value={prefs[name] ? "on" : "off"}
              onChange={(value) => flip(name, value === "on")}
            />
          </li>
        ))}
      </ul>
    </Modal>
  );
}
