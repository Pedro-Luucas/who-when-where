"use client";

import { saveShape } from "@/lib/saves";
import { usePersistent, type Check } from "@/lib/storage";
import type { GameDefinition } from "./definition";
import type { GameSave } from "./types";

// Every game keeps its daily puzzles the same way: `{ days, seenHelp }` under
// the key its definition names. This is the one hook that reads and writes it.

const EMPTY: GameSave<never> = { days: {}, seenHelp: false };

// One check per game, so the hook is handed the same function every time.
const checks = new Map<string, Check>();

function checkOf({ save }: GameDefinition): Check {
  let check = checks.get(save.key);
  if (!check) {
    check = saveShape(save.progressField, ...(save.lists ?? []));
    checks.set(save.key, check);
  }
  return check;
}

/** A game's saved daily puzzles, and the way to change them. */
export function useGameSave<Saved>(definition: GameDefinition) {
  return usePersistent<GameSave<Saved>>(definition.save.key, EMPTY, checkOf(definition));
}

/** The moves a day's record holds. */
export function movesOf<Move>(definition: GameDefinition, record: unknown): Move[] {
  const moves = (record as { [field: string]: unknown } | null | undefined)?.[definition.save.progressField];
  return Array.isArray(moves) ? (moves as Move[]) : [];
}
