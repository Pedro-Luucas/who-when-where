"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { GameSkeleton } from "@/components/daily";
import type { GameBoard, GameData } from "./platform/types";
import type { GameSlug } from "./registry";

// Where the games themselves are loaded from. Nothing else on the site imports
// a game's board or data: a page that shows one game fetches that game, and a
// page that shows none fetches none. Every import() below is its own chunk.
//
// A new game is named three times here — its screen, its board, its data.

const loading = () => <GameSkeleton />;
const screen = (module: { default: GameBoard }) => module.default.Screen;

/**
 * Each game as the daily page shows it. Loaded with the page (the chunk is
 * announced in its HTML), so today's puzzle does not wait for a second trip.
 */
export const SCREENS: Record<GameSlug, ComponentType> = {
  "who-when-where": dynamic(() => import("./who-when-where/board").then(screen), { loading }),
  wayfarer: dynamic(() => import("./wayfarer/board").then(screen), { loading }),
  "dig-site": dynamic(() => import("./dig-site/board").then(screen), { loading }),
  "first-to-last": dynamic(() => import("./first-to-last/board").then(screen), { loading }),
  overland: dynamic(() => import("./overland/board").then(screen), { loading }),
  outline: dynamic(() => import("./outline/board").then(screen), { loading }),
  "lifelines": dynamic(() => import("./lifelines/board").then(screen), { loading }),
  "clue-ladder": dynamic(() => import("./clue-ladder/board").then(screen), { loading }),
  "born-here": dynamic(() => import("./born-here/board").then(screen), { loading }),
  "could-they-meet": dynamic(() => import("./could-they-meet/board").then(screen), { loading }),
  "earlier-or-later": dynamic(() => import("./earlier-or-later/board").then(screen), { loading }),
  "same-year": dynamic(() => import("./same-year/board").then(screen), { loading }),
  "pin-the-city": dynamic(() => import("./pin-the-city/board").then(screen), { loading }),
  "click-the-country": dynamic(() => import("./click-the-country/board").then(screen), { loading }),
  "type-the-countries": dynamic(() => import("./type-the-countries/board").then(screen), { loading }),
  "flag-peek": dynamic(() => import("./flag-peek/board").then(screen), { loading }),
  "higher-or-lower": dynamic(() => import("./higher-or-lower/board").then(screen), { loading }),
  "border-chain": dynamic(() => import("./border-chain/board").then(screen), { loading }),
};

const BOARDS: Record<GameSlug, () => Promise<{ default: GameBoard }>> = {
  "who-when-where": () => import("./who-when-where/board"),
  wayfarer: () => import("./wayfarer/board"),
  "dig-site": () => import("./dig-site/board"),
  "first-to-last": () => import("./first-to-last/board"),
  overland: () => import("./overland/board"),
  outline: () => import("./outline/board"),
  "lifelines": () => import("./lifelines/board"),
  "clue-ladder": () => import("./clue-ladder/board"),
  "born-here": () => import("./born-here/board"),
  "could-they-meet": () => import("./could-they-meet/board"),
  "earlier-or-later": () => import("./earlier-or-later/board"),
  "same-year": () => import("./same-year/board"),
  "pin-the-city": () => import("./pin-the-city/board"),
  "click-the-country": () => import("./click-the-country/board"),
  "type-the-countries": () => import("./type-the-countries/board"),
  "flag-peek": () => import("./flag-peek/board"),
  "higher-or-lower": () => import("./higher-or-lower/board"),
  "border-chain": () => import("./border-chain/board"),
};

const DATA: Record<GameSlug, () => Promise<{ default: GameData }>> = {
  "who-when-where": () => import("./who-when-where/data"),
  wayfarer: () => import("./wayfarer/data"),
  "dig-site": () => import("./dig-site/data"),
  "first-to-last": () => import("./first-to-last/data"),
  overland: () => import("./overland/data"),
  outline: () => import("./outline/data"),
  "lifelines": () => import("./lifelines/data"),
  "clue-ladder": () => import("./clue-ladder/data"),
  "born-here": () => import("./born-here/data"),
  "could-they-meet": () => import("./could-they-meet/data"),
  "earlier-or-later": () => import("./earlier-or-later/data"),
  "same-year": () => import("./same-year/data"),
  "pin-the-city": () => import("./pin-the-city/data"),
  "click-the-country": () => import("./click-the-country/data"),
  "type-the-countries": () => import("./type-the-countries/data"),
  "flag-peek": () => import("./flag-peek/data"),
  "higher-or-lower": () => import("./higher-or-lower/data"),
  "border-chain": () => import("./border-chain/data"),
};

// One request per module, however many ask. A failed one is forgotten, so the next ask tries again.
function once<T>(loaders: Record<GameSlug, () => Promise<{ default: T }>>) {
  const loaded = new Map<GameSlug, Promise<T>>();
  return (slug: GameSlug): Promise<T> => {
    let promise = loaded.get(slug);
    if (!promise) {
      promise = loaders[slug]().then((module) => module.default);
      promise.catch(() => loaded.delete(slug));
      loaded.set(slug, promise);
    }
    return promise;
  };
}

/** A game's interface (and, with it, its data): for the pages that play it. */
export const loadBoard = once(BOARDS);

/** A game's roster and rules, without its interface: for scoring, dealing and the logbook. */
export const loadData = once(DATA);
