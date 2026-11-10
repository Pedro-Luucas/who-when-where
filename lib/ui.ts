"use client";

import { useSyncExternalStore } from "react";

// Which overlay panel is open. Lives outside React so the site header can
// open a panel that the current game renders.

export type Panel = "help" | "stats" | null;

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
