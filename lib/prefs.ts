"use client";

import { readStore, usePersistent, writeStore } from "./storage";

// How the player likes the site: its colours, and whether it makes noise,
// buzzes and throws confetti. Kept on the device.

export const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export type Prefs = {
  /** auto follows the device. */
  theme: Theme;
  sound: boolean;
  /** Vibration, on devices that can. */
  haptics: boolean;
  /** Confetti and other celebrations. */
  effects: boolean;
};

/** The key in lib/storage. THEME_SCRIPT reads the same entry before the page paints. */
const KEY = "prefs";
const DEFAULTS: Prefs = { theme: "auto", sound: true, haptics: true, effects: true };

/** The player's preferences. Browser only. */
export function getPrefs(): Prefs {
  return { ...DEFAULTS, ...readStore<Partial<Prefs>>(KEY, DEFAULTS) };
}

export function usePrefs(): [Prefs, (change: Partial<Prefs>) => void] {
  const [stored] = usePersistent<Partial<Prefs>>(KEY, DEFAULTS);
  return [{ ...DEFAULTS, ...stored }, (change) => writeStore(KEY, { ...getPrefs(), ...change })];
}

/** Puts a theme on the page: `data-theme` on <html>, which the stylesheet reads. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/**
 * Runs in <head>, before the first paint, so a chosen theme never flashes
 * the other one. Mirrors applyTheme(getPrefs().theme) without the modules.
 */
export const THEME_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem("www:${KEY}")||"{}").theme;if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
