"use client";

import { createContext, useContext } from "react";
import type { FamilyId } from "../families";

// What a board knows about the screen it is on, for the parts every game
// shares (the HUD, the prompt plaque, the result card): which game it is, and
// whether this is its daily page (with the way back to the catalogue, the rules
// and the statistics), its practice page (unlimited puzzles, no statistics) or
// a stage in someone's run (an expedition, a party).

export type GameFrame = {
  slug: string;
  title: string;
  family: FamilyId;
  /** The game's daily page: the HUD offers "All games", How to play and Statistics. */
  daily: boolean;
  /** The game's practice page: "All games" and How to play, but no daily statistics. */
  practice?: boolean;
};

const Frame = createContext<GameFrame | null>(null);

export const GameFrameProvider = Frame.Provider;

/** The frame a board is rendered in, if any. */
export function useGameFrame(): GameFrame | null {
  return useContext(Frame);
}

/** The CSS custom property that colours a screen in its game's family. */
export const familyStyle = (family: FamilyId | undefined) =>
  (family ? { "--fam": `var(--color-family-${family})` } : undefined) as React.CSSProperties | undefined;
