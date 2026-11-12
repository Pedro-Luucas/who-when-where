"use client";

import { useSyncExternalStore } from "react";

// Which overlay panel is open. Lives outside React so the site header can
// open a panel that the current game renders.

/** help, stats: the current game's panels. me: the phone's account sheet (shell/me-sheet.tsx). */
export type Panel = "help" | "stats" | "me" | null;

let current: Panel = null;
const listeners = new Set<() => void>();

export function openPanel(panel: Panel): void {
  current = panel;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePanel(): Panel {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
