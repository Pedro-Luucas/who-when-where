"use client";

import type { SyncedSave } from "@/lib/saves";
import { readStore } from "@/lib/storage";
import { GAMES } from "./registry";

/** Saves that follow a signed-in player across devices: every game's. */
export const SYNCED_SAVES: SyncedSave[] = GAMES.map(({ slug, save }) => ({
  game: slug,
  key: save.key,
  progressField: save.progressField,
}));

type Save = { days?: Record<string, Record<string, unknown> | null> } | null;

/** Every move made in a daily puzzle on this device, all games together. Browser only. */
export function countMoves(): number {
  let moves = 0;
  for (const { key, progressField } of SYNCED_SAVES) {
    for (const record of Object.values(readStore<Save>(key, null)?.days ?? {})) {
      const made = record?.[progressField];
      if (Array.isArray(made)) moves += made.length;
    }
  }
  return moves;
}
