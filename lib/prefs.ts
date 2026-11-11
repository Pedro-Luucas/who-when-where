"use client";

import { readStore, usePersistent, writeStore } from "./storage";

// How the player likes the site: its colours, and whether it makes noise,
// buzzes and throws confetti. Kept on the device.

export const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export type Prefs = {
  /** dark is Night Atlas (the default), light is Daylight; auto follows the device. */
  theme: Theme;
  sound: boolean;
  /** Vibration, on devices that can. */
  haptics: boolean;
  /** Confetti and other celebrations. */
  effects: boolean;
};

/** The key in lib/storage. THEME_SCRIPT reads the same entry before the page paints. */
const KEY = "prefs";
const DEFAULTS: Prefs = { theme: "dark", sound: true, haptics: true, effects: true };

/** The player's preferences. Browser only. */
export function getPrefs(): Prefs {
  return { ...DEFAULTS, ...readStore<Partial<Prefs>>(KEY, DEFAULTS) };
}

export function usePrefs(): [Prefs, (change: Partial<Prefs>) => void] {
  const [stored] = usePersistent<Partial<Prefs>>(KEY, DEFAULTS);
  return [{ ...DEFAULTS, ...stored }, (change) => writeStore(KEY, { ...getPrefs(), ...change })];
}

/** The theme a choice comes to on this device: auto is light only when the device asks for it. */
function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "auto") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Puts a theme on the page: `data-theme` on <html>, which app/tokens.css
 * reads. The stylesheet is dark unless it says "light".
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(theme));
}

/**
 * Runs in <head>, before the first paint, so a chosen theme never flashes
 * the other one. Mirrors applyTheme(getPrefs().theme) without the modules.
 */
export const THEME_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem("www:${KEY}")||"{}").theme;if(t==="auto")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){}})()`;
