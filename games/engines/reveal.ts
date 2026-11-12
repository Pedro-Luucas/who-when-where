"use client";

import { useEffect, useEffectEvent, useState } from "react";

/**
 * Round-by-round games show what an answer was before moving on. The moves
 * are saved the moment they are made, so "has the player seen this answer"
 * is kept apart: a board opened on a saved day shows no stale verdict, and an
 * answer just given stays on screen until the player asks for the next round.
 *
 *   const reveal = useReveal(moves.length);
 *   reveal.showing  — the answer on screen waits for "Next"
 *   reveal.next()   — the player has seen it
 *   reveal.skip(n)  — n moves are about to be added without a verdict (giving up)
 */
export function useReveal(made: number) {
  const [seen, setSeen] = useState(made);
  return {
    showing: made > seen,
    next: () => setSeen(made),
    skip: (count: number) => setSeen(made + count),
  };
}

/** Calls `onKey` for the keys a board listens to, unless the player is typing in a field. */
export function useBoardKeys(onKey: (key: string) => boolean | void, active = true): void {
  const handle = useEffectEvent((key: string) => onKey(key));
  useEffect(() => {
    if (!active) return;
    function listen(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], dialog[open]")) return;
      if (handle(event.key)) event.preventDefault();
    }
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, [active]);
}
