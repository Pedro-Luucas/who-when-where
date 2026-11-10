"use client";

import type { SyncedSave } from "@/lib/saves";
import { readStore } from "@/lib/storage";
import { SYNC as digSite } from "./dig-site/store";
import { SYNC as firstToLast } from "./first-to-last/store";
import { SYNC as outline } from "./outline/store";
import { SYNC as overland } from "./overland/store";
import { SYNC as wayfarer } from "./wayfarer/store";
import { SYNC as whoWhenWhere } from "./who-when-where/store";

/** Saves that follow a signed-in player across devices. List every game's here. */
export const SYNCED_SAVES: SyncedSave[] = [whoWhenWhere, wayfarer, digSite, firstToLast, overland, outline];

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
