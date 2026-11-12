"use client";

import { useSyncExternalStore } from "react";
import { readStore, subscribeToStore, writeStore } from "@/lib/storage";
import { loadData } from "./loaders";
import type { GameDefinition } from "./platform/definition";
import { scorerOf, type Scorer } from "./platform/scorers";
import { GAMES, inChallenge, type GameSlug } from "./registry";

// Every game's finished days, read on one scale (lib/points.ts). This is what
// the daily challenge, the activity graph and the leaderboards are built on.
//
// Scoring a saved day takes the game's rules, and often its roster — far too
// much to load on every page. So the scores are kept beside the saves, in an
// index: for each saved day, a fingerprint of its record and what it earned.
// Reading the results is then a lookup, with no game loaded at all.
//
// The saves stay the truth. An entry only counts while its fingerprint matches
// the record that is saved now, and settleResults() fills in whatever is
// missing: at once for a game that is loaded (the one being played, so a move
// and its score arrive together), and after fetching its data for one that is not
// (days synced from another device, or saved before the index existed).

/** A finished daily puzzle. */
export type DailyResult = { game: GameSlug; day: number; points: number; detail: string };

type Save = { days?: Record<string, unknown> } | null;

/** A saved day: its record's fingerprint, then — once it is finished — its points and short result. */
type Entry = [print: number, points: number, detail: string] | [print: number];
type Index = { [slug: string]: { v: number; days: { [day: string]: Entry } } | undefined };

const INDEX_KEY = "results:v1";
const NO_INDEX: Index = {};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A record is not changed in place, so its fingerprint is worked out once.
const prints = new WeakMap<object, number>();

function printOf(record: object): number {
  let print = prints.get(record);
  if (print === undefined) {
    const text = JSON.stringify(record);
    let hash = 2166136261 ^ text.length;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    print = hash >>> 0;
    prints.set(record, print);
  }
  return print;
}

/** The days of a save that could hold a puzzle: a whole number from 1, and a record. */
function daysOf(save: Save): [string, object][] {
  if (!isObject(save) || !isObject(save.days)) return [];
  return Object.entries(save.days).filter((entry): entry is [string, object] => {
    const day = Number(entry[0]);
    return Number.isInteger(day) && day >= 1 && typeof entry[1] === "object" && entry[1] !== null;
  });
}

const versionOf = (game: GameDefinition): number => game.scoring ?? 1;

/** The entries the index holds for a game, if they were worked out by the scoring in use. */
function entriesOf(index: Index, game: GameDefinition): { [day: string]: Entry } {
  const held = index[game.slug];
  return isObject(held) && held.v === versionOf(game) && isObject(held.days) ? held.days : {};
}

const matches = (entry: Entry | undefined, print: number): entry is Entry =>
  Array.isArray(entry) && entry[0] === print;

function entryFor(print: number, scorer: Scorer, record: object): Entry {
  try {
    const score = scorer(record);
    if (score) return [print, score.points, score.detail];
  } catch {
    // A save from an older version, or a damaged one: not a finished day.
  }
  return [print];
}

const readSaves = (): Save[] => GAMES.map((game) => readStore<Save>(game.save.key, null));
const readIndex = (): Index => readStore<Index>(INDEX_KEY, NO_INDEX);

/** Whether two lists hold the very same things, in the same order. */
const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((item, i) => item === b[i]);

// ── Keeping the index in line with the saves ────────────────────────────────

// What the last pass looked at: nothing needs doing again until one of these changes.
let settled: unknown[] | null = null;

/**
 * Brings the index in line with the saves, as far as the games loaded so far
 * allow. Returns the games whose data is needed to finish the job.
 */
function settle(): GameSlug[] {
  const index = readIndex();
  const saves = readSaves();
  const scorers = GAMES.map((game) => scorerOf(game.slug));
  const looked = [index, ...saves, ...scorers];
  if (settled && same(settled, looked)) return [];

  const next: Index = {};
  const unloaded: GameSlug[] = [];
  let changed = Object.keys(index).some((slug) => !GAMES.some((game) => game.slug === slug));

  GAMES.forEach((game, i) => {
    const known = entriesOf(index, game);
    const scorer = scorers[i];
    const days: { [day: string]: Entry } = {};
    let count = 0;
    for (const [day, record] of daysOf(saves[i])) {
      const print = printOf(record);
      const entry = known[day];
      if (matches(entry, print)) {
        days[day] = entry;
      } else if (scorer) {
        days[day] = entryFor(print, scorer, record);
        changed = true;
      } else {
        if (!unloaded.includes(game.slug)) unloaded.push(game.slug);
        continue;
      }
      count++;
    }
    if (count) next[game.slug] = { v: versionOf(game), days };
    // Entries of days that are gone, or worked out by an older scoring, are dropped.
    const held = index[game.slug];
    const heldDays = isObject(held) ? held.days : undefined;
    if (held !== undefined && (count !== Object.keys(known).length || known !== heldDays)) changed = true;
  });

  if (changed) writeStore(INDEX_KEY, next);
  // The write above has already been looked at by a pass of its own (see start), unless nothing listens yet.
  if (!unloaded.length) settled = changed ? null : looked;
  return unloaded;
}

let loading: Promise<void> | null = null;

/**
 * Works out every result that can be, fetching the data of the games it needs.
 * Resolves once the results are as complete as they will get.
 */
export function settleResults(): Promise<void> {
  start();
  const unloaded = settle();
  if (!unloaded.length) return Promise.resolve();
  loading ??= Promise.allSettled(unloaded.map((slug) => loadData(slug))).then((outcomes) => {
    loading = null;
    // Loading a game's data registers its scoring. If none arrived (offline), the next change tries again.
    if (outcomes.some((outcome) => outcome.status === "fulfilled")) return settleResults();
  });
  return loading;
}

let started = false;

/** From the first look on, every change to what is saved is scored as it happens. */
function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  subscribeToStore(() => void settleResults());
}

// ── Reading the results ─────────────────────────────────────────────────────

// The saves and the index are cached by lib/storage until they change, so the results can be too.
let cached: { looked: unknown[]; results: DailyResult[] } | null = null;
const NONE: DailyResult[] = [];

/**
 * Every finished daily puzzle saved on this device, as far as it has been
 * scored (await settleResults() first to be sure of all of them). Browser only.
 */
export function readDailyResults(): DailyResult[] {
  const index = readIndex();
  const saves = readSaves();
  const looked = [index, ...saves];
  if (cached && same(cached.looked, looked)) return cached.results;

  const results: DailyResult[] = [];
  GAMES.forEach((game, i) => {
    const known = entriesOf(index, game);
    for (const [day, record] of daysOf(saves[i])) {
      const entry = known[day];
      if (matches(entry, printOf(record)) && entry.length === 3) {
        results.push({ game: game.slug, day: Number(day), points: entry[1], detail: entry[2] });
      }
    }
  });
  cached = { looked, results };
  return results;
}

function subscribe(listener: () => void): () => void {
  const stop = subscribeToStore(listener);
  // After the listener: whatever this first pass works out reaches it.
  void settleResults();
  return stop;
}

/** The same, as a hook that follows the saves. */
export function useDailyResults(): DailyResult[] {
  return useSyncExternalStore(subscribe, readDailyResults, () => NONE);
}

/**
 * The days with at least one of the dailies finished (games/daily-set.ts):
 * the days a streak counts (lib/streak.ts).
 */
export function streakDays(results: DailyResult[]): number[] {
  return [...new Set(results.filter((result) => inChallenge(result.game)).map((result) => result.day))];
}

/** What was played on each day: how many puzzles, and for how many points. */
export type DayActivity = { day: number; puzzles: number; points: number };

export function activityOf(results: DailyResult[]): DayActivity[] {
  const days = new Map<number, DayActivity>();
  for (const { day, points } of results) {
    const entry = days.get(day) ?? { day, puzzles: 0, points: 0 };
    entry.puzzles++;
    entry.points += points;
    days.set(day, entry);
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}
