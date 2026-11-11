"use client";

import { SCREENS } from "../loaders";
import type { GameSlug } from "../registry";

/** Today's puzzle of one game. Fetches that game, and no other. */
export function GameScreen({ game }: { game: GameSlug }) {
  const Screen = SCREENS[game];
  return <Screen />;
}
