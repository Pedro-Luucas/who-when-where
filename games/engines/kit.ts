import type { Locale } from "@/lib/i18n";
import { MAX_POINTS, type Score } from "@/lib/points";
import { streaks } from "@/lib/stats";
import { PASS, tallyPicks } from "./rules";
import { defineData, type Discovery, type DiscoveryKind, type GameData, type GameSave, type StatTile } from "../platform/types";

// What the games built on the engines share, so each one only says what is
// its own: a puzzle named by a list of ids (its rounds, its people), a day's
// record that is those ids and the moves made, the statistics panel and the
// line players paste into chats.

/** A day's record: the ids that name the puzzle, and the moves made on it. */
export type SetRecord<Move> = { ids: string[]; moves: Move[] };

/** The save every engine game keeps: moves under `moves`, the puzzle under `ids`. */
export const SET_SAVE = (key: string) => ({ key, progressField: "moves", lists: ["ids"] });

type Spec<Puzzle, Move> = {
  /** The puzzle everyone gets on `day`. */
  forDay: (day: number) => Puzzle;
  /** One puzzle for a seed (practice, expeditions); `variant` is a practice variant's id. */
  deal: (seed: string, variant?: string) => Puzzle;
  /** The puzzle the ids name, unless something in it has left the roster. */
  fromIds: (ids: string[]) => Puzzle | undefined;
  idsOf: (puzzle: Puzzle) => string[];
  score: (puzzle: Puzzle, moves: Move[], tries?: number) => Score;
  answer: (puzzle: Puzzle, locale: Locale) => string;
  /** What a finished puzzle revealed, for the logbook's atlas. */
  discover?: (puzzle: Puzzle, day: number) => Discovery[];
  totals?: Partial<{ [kind in DiscoveryKind]: number | null }>;
};

const isSetRecord = (record: unknown): record is SetRecord<unknown> =>
  typeof record === "object" &&
  record !== null &&
  Array.isArray((record as SetRecord<unknown>).ids) &&
  Array.isArray((record as SetRecord<unknown>).moves);

/** Declares the data of a game whose records are SetRecords. */
export function defineSetData<Puzzle, Move>(slug: string, spec: Spec<Puzzle, Move>): GameData {
  const puzzleOfRecord = (record: SetRecord<Move>) => (isSetRecord(record) ? spec.fromIds(record.ids) : undefined);
  return defineData<Puzzle, Move, SetRecord<Move>>(slug, {
    puzzleForDay: spec.forDay,
    deal: (seed, count, variant) =>
      Array.from({ length: count }, (_, i) => spec.idsOf(spec.deal(`${seed}:${i}`, variant))),
    puzzleOf: spec.fromIds,
    puzzleOfRecord,
    idsOf: spec.idsOf,
    recordOf: (puzzle, moves) => ({ ids: spec.idsOf(puzzle), moves }),
    score: spec.score,
    resultOf(record) {
      const puzzle = puzzleOfRecord(record);
      if (puzzle === undefined) return null;
      const score = spec.score(puzzle, record.moves);
      return score.over ? score : null;
    },
    answer: spec.answer,
    discover(record, day) {
      const puzzle = puzzleOfRecord(record);
      if (puzzle === undefined || !spec.score(puzzle, record.moves).over) return [];
      return spec.discover?.(puzzle, day) ?? [];
    },
    totals: spec.totals ?? {},
  });
}

type SiteWords = (key: "statPlayed" | "statStreak" | "statLongest") => string;

/**
 * The statistics panel of an engine game: puzzles finished, average and best
 * points, and the streak (a run of days with the puzzle finished: the rule
 * every game shares).
 */
export function setStats<Move>(
  save: GameSave<SetRecord<Move>>,
  today: number,
  data: GameData,
  words: { site: SiteWords; average: string; best: string },
): { played: number; tiles: StatTile[] } {
  const finished = Object.entries(save.days)
    .map(([day, record]) => ({ day: Number(day), score: data.resultOf(record) }))
    .filter((entry): entry is { day: number; score: Score } => entry.score !== null);
  const points = finished.map((entry) => entry.score.points);
  const { streak, longest } = streaks(
    finished.map((entry) => entry.day),
    today,
  );
  return {
    played: finished.length,
    tiles: [
      { label: words.site("statPlayed"), value: finished.length },
      { label: words.average, value: points.length ? Math.round(points.reduce((a, b) => a + b, 0) / points.length) : 0 },
      { label: words.best, value: points.length ? Math.max(...points) : 0 },
      { label: words.site("statStreak"), value: streak },
      { label: words.site("statLongest"), value: longest },
    ],
  };
}

/** "Born Here #12 · 700/1000", a row of squares, the address. */
export function shareLines(title: string, day: number, points: number, squares: string, url: string): string {
  return [`${title} #${day} · ${points}/${MAX_POINTS}`, squares, url].filter(Boolean).join("\n");
}

/** 🟩 for a hit, 🟨 for a near one, 🟥 for a miss, ⬜ for one given up. */
export const SQUARE = { hit: "🟩", near: "🟨", miss: "🟥", skip: "⬜" } as const;

/** A run of picks as squares: one per round answered. */
export function pickSquares(answers: readonly string[], moves: readonly string[], lives?: number): string {
  return tallyPicks(answers, moves, lives)
    .rounds.map((right, i) => (moves[i] === PASS ? SQUARE.skip : right ? SQUARE.hit : SQUARE.miss))
    .join("");
}

/** Map rounds as squares, by what each finished round earned (the Pin engine's verdicts). */
export function roundSquares(rounds: readonly { done: boolean; tries: readonly unknown[]; share: number }[]): string {
  return rounds
    .filter((round) => round.done)
    .map((round) =>
      round.tries.length === 0
        ? SQUARE.skip
        : round.share >= 0.85
          ? SQUARE.hit
          : round.share >= 0.4
            ? SQUARE.near
            : SQUARE.miss,
    )
    .join("");
}

// ── Small helpers for the data modules ──────────────────────────────────────

/** Picks one of `items` with `random` (0 ≤ n < 1). */
export const pickOne = <T>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];

/** The shell's verdict on a score (lib/shell-messages.ts): "Perfect!", "Great game"… */
export const headlineKey = (points: number) =>
  points >= MAX_POINTS
    ? ("resultPerfect" as const)
    : points >= 700
      ? ("resultGreat" as const)
      : points >= 400
        ? ("resultGood" as const)
        : ("resultPoor" as const);

/** The words of the statistics panel every engine game shows. */
export const STAT_WORDS = {
  en: { statAverage: "Average", statBest: "Best" },
  pt: { statAverage: "Média", statBest: "Melhor" },
} as const;
