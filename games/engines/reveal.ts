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
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      // Taken already: the map's own keys (Enter drops its pin), a field's.
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], dialog[open]")) return;
      // A focused key (Next, Lock in) is pressed by Enter and Space itself: not twice.
      if ((event.key === "Enter" || event.key === " ") && target?.closest("button, a, [role='button']")) return;
      if (handle(event.key)) event.preventDefault();
    }
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, [active]);
}

/**
 * The keys of an ordering board (First to Last, Lifelines, any Order game):
 * a letter puts that card in the next free slot (or takes it back), Backspace
 * takes back the last card placed, Enter checks a full line.
 */
export function useOrderKeys(board: {
  /** The cards, in the order they are lettered (A, B, C…). */
  ids: readonly string[];
  toggle: (id: string) => void;
  /** Takes back the last card placed; false when there is none. */
  undo: () => boolean;
  check: () => void;
  full: boolean;
  active: boolean;
}): void {
  useBoardKeys((key) => {
    if (key === "Enter") {
      if (!board.full) return false;
      board.check();
      return true;
    }
    if (key === "Backspace") return board.undo();
    if (key.length !== 1) return false;
    const at = key.toUpperCase().charCodeAt(0) - 65;
    if (at < 0 || at >= board.ids.length) return false;
    board.toggle(board.ids[at]);
    return true;
  }, board.active);
}

/** The picks with the last one the player placed (not a locked one) taken back, or null if there is none. */
export function withoutLastPick<T>(picks: readonly (T | null)[], locked: readonly (T | null)[]): (T | null)[] | null {
  for (let i = picks.length - 1; i >= 0; i--) {
    if (picks[i] !== null && locked[i] === null) return picks.map((pick, j) => (j === i ? null : pick));
  }
  return null;
}
