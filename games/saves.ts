"use client";

import type { SyncedSave } from "@/lib/saves";
import { SYNC as digSite } from "./dig-site/store";
import { SYNC as firstToLast } from "./first-to-last/store";
import { SYNC as wayfarer } from "./wayfarer/store";
import { SYNC as whoWhenWhere } from "./who-when-where/store";

/** Saves that follow a signed-in player across devices. List every game's here. */
export const SYNCED_SAVES: SyncedSave[] = [whoWhenWhere, wayfarer, digSite, firstToLast];
