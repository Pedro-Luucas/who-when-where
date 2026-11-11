"use client";

import { useSyncExternalStore } from "react";

// Whether the player points with a mouse (or trackpad) rather than a finger,
// so instructions can say "click" and "scroll" instead of "tap" and "pinch".

const QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** True with a mouse or trackpad. False on the server and on touch screens. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
