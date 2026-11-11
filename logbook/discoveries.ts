"use client";

import { use, useSyncExternalStore } from "react";
import { loadData } from "@/games/loaders";
import { DISCOVERY_KINDS, type Discovery, type DiscoveryKind, type GameData } from "@/games/platform/types";
import { GAMES } from "@/games/registry";
import { readStore, subscribeToStore } from "@/lib/storage";

// What the player has come across: every person, journey, site, moment and
// country a finished puzzle revealed, read from the games saved on the device.
// Each game says what its finished days reveal (its data module's `discover`);
// the logbook is the one page that asks all of them, so it fetches every
// game's data — and only when it is opened.

export const KINDS = DISCOVERY_KINDS;
export type Kind = DiscoveryKind;
export type { Discovery };

/** How many there are to find of each kind; null where there is no end to them. */
export type Totals = Record<Kind, number | null>;

type Save = { days?: Record<string, unknown> } | null;

let everything: Promise<GameData[]> | null = null;

/** Every game's data, in the order of the registry. */
function loadEverything(): Promise<GameData[]> {
  everything ??= Promise.all(GAMES.map((game) => loadData(game.slug)));
  // Should it fail (the network dropped), the next visit tries again.
  everything.catch(() => (everything = null));
  return everything;
}

// The saves are cached by lib/storage until they change, so what they reveal can be too.
let cached: { saves: Save[]; found: Discovery[] } | null = null;

function discoveriesIn(saves: Save[], data: GameData[]): Discovery[] {
  if (cached && saves.every((save, i) => save === cached?.saves[i])) return cached.found;

  const found = new Map<string, Discovery>();
  data.forEach((game, i) => {
    for (const [key, record] of Object.entries(saves[i]?.days ?? {})) {
      const day = Number(key);
      if (!Number.isInteger(day) || day < 1) continue;
      try {
        for (const discovery of game.discover(record, day)) found.set(`${discovery.kind}:${discovery.id}`, discovery);
      } catch {
        // A day saved by an older version, or a damaged one, discovers nothing.
      }
    }
  });
  cached = { saves, found: [...found.values()].sort((a, b) => a.day - b.day) };
  return cached.found;
}

const readSaves = (): Save[] => GAMES.map((game) => readStore<Save>(game.save.key, null));

let savesSeen: Save[] = [];

/** The saves, as one value that only changes when one of them does. */
function savesSnapshot(): Save[] {
  const saves = readSaves();
  if (saves.length !== savesSeen.length || saves.some((save, i) => save !== savesSeen[i])) savesSeen = saves;
  return savesSeen;
}

const NO_SAVES: Save[] = [];

/** Everything discovered so far, oldest first, and how much there is to find. Suspends while the games load. */
export function useDiscoveries(): { discoveries: Discovery[]; totals: Totals } {
  const data = use(loadEverything());
  const saves = useSyncExternalStore(subscribeToStore, savesSnapshot, () => NO_SAVES);

  const totals = Object.fromEntries(KINDS.map((kind) => [kind, null])) as Totals;
  for (const game of data) Object.assign(totals, game.totals);

  return { discoveries: discoveriesIn(saves, data), totals };
}
