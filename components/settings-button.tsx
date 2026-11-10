"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { cue } from "@/lib/fx";
import { useSiteT } from "@/lib/i18n";
import { THEMES, applyTheme, getPrefs, usePrefs, type Prefs } from "@/lib/prefs";
import { Segmented } from "./controls";
import { LocaleToggle } from "./locale-toggle";
import { Modal } from "./modal";

type Switch = "sound" | "haptics" | "effects";
const SWITCHES: Switch[] = ["sound", "haptics", "effects"];

/** Header button that opens the settings: theme, language, sound, vibration, confetti. */
export function SettingsButton() {
  const t = useSiteT();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = usePrefs();

  // The script in <head> has already put the theme on the page; this follows
  // later changes (and puts it back after React's remount in development).
  // Read from the device, not from `prefs`: while the page hydrates, `prefs`
  // still holds the defaults.
  useLayoutEffect(() => applyTheme(getPrefs().theme), [prefs.theme]);

  function flip(name: Switch, on: boolean) {
    setPrefs({ [name]: on } as Partial<Prefs>);
    // Let the player hear (or feel) what they have just turned on.
    if (on && name !== "effects") cue("move");
  }

  return (
    <>
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen(true)}
        aria-label={t("settings")}
        title={t("settings")}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M2 4.5h6.2M11.8 4.5H14M2 11.5h2.2M7.8 11.5H14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="4.5" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="6" cy="11.5" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("settings")} closeLabel={t("close")}>
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
    </>
  );
}

/** Header link to the logbook: level, achievements and atlas. */
export function LogbookButton() {
  const t = useSiteT();
  return (
    <Link href="/logbook" className="icon-button" aria-label={t("logbook")} title={t("logbook")}>
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path
          d="M8 3.6C6.6 2.7 4.7 2.4 2.3 2.6v9.6c2.4-.2 4.3.1 5.7 1 1.4-.9 3.3-1.2 5.7-1V2.6c-2.4-.2-4.3.1-5.7 1zM8 3.6v9.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
