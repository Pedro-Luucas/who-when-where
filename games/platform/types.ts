import type { ComponentType, ReactNode } from "react";
import type { Country } from "@/lib/countries";
import type { LatLon } from "@/lib/geo";
import type { Locale, Localized } from "@/lib/i18n";
import type { Score } from "@/lib/points";
import { registerScorer } from "./scorers";

// The two halves of a game that are loaded on demand (games/loaders.tsx):
//
//   data  — its roster and rules: which puzzle a day or a seed deals, how a
//           puzzle is scored, what a finished one reveals. No interface.
//   board — its interface: the board a puzzle is played on, and the words
//           and numbers the daily page puts around it.
//
// Each game writes them with its own types (defineData here, defineBoard in
// board.tsx); the site handles them without knowing what a puzzle or a move is.

/** A game's daily puzzles as they are stored: one record per day started. */
export type GameSave<Saved = unknown> = { days: { [day: string]: Saved }; seenHelp: boolean };

// ── What a finished puzzle reveals, for the logbook's atlas ─────────────────

export const DISCOVERY_KINDS = ["person", "journey", "site", "event", "country", "crossing"] as const;
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];

export type Discovery = {
  kind: DiscoveryKind;
  /** Unique within its kind. */
  id: string;
  /** The puzzle number it came up on (the latest, when it came up twice). */
  day: number;
  name: Localized;
  /** Where its pin goes on the atlas. */
  place: LatLon;
  /** A line to draw: a journey's route, the countries of a crossing. */
  route?: LatLon[];
  /** The country to colour in. */
  country?: Country;
  wiki?: { en: string; pt: string | null };
};

// ── Data ────────────────────────────────────────────────────────────────────

export type GameDataOf<Puzzle, Move, Saved> = {
  /** The puzzle everyone gets on `day`. */
  puzzleForDay: (day: number) => Puzzle;
  /**
   * `count` puzzles for games played outside the daily calendar, each named by
   * its ids. The same seed always deals the same puzzles. `variant` is one of
   * the definition's variants (practice only); left out, the first.
   */
  deal: (seed: string, count: number, variant?: string) => string[][];
  /** The puzzle the ids name, unless it is no longer in the roster. */
  puzzleOf: (ids: string[]) => Puzzle | undefined;
  /** The puzzle a saved day was played on, unless it is no longer in the roster. */
  puzzleOfRecord: (record: Saved) => Puzzle | undefined;
  /** The ids that name a puzzle: one for most games, several where a puzzle is a set. */
  idsOf: (puzzle: Puzzle) => string[];
  /** A day's record, as the game has always saved it. */
  recordOf: (puzzle: Puzzle, moves: Move[]) => Saved;
  /** How a puzzle stands after `moves`. `tries` is how many the host allows; the game's own when left out. */
  score: (puzzle: Puzzle, moves: Move[], tries?: number) => Score;
  /** A finished day's score, or null while it is still being played. */
  resultOf: (record: Saved) => Score | null;
  /** What the puzzle was about, for the results: a name, never shown early. */
  answer: (puzzle: Puzzle, locale: Locale) => string;
  /** What a saved day revealed, once it is finished. */
  discover: (record: Saved, day: number) => Discovery[];
  /** How many there are to find of each kind the game reveals; null where there is no end to them. */
  totals: Partial<{ [kind in DiscoveryKind]: number | null }>;
};

/** A game's data, with its own types set aside. */
export type GameData = GameDataOf<unknown, unknown, unknown>;

/** Declares a game's data. From then on the site can score that game's saved days (see games/results.ts). */
export function defineData<Puzzle, Move, Saved>(slug: string, data: GameDataOf<Puzzle, Move, Saved>): GameData {
  const erased = data as unknown as GameData;
  registerScorer(slug, erased.resultOf);
  return erased;
}

// ── Board ───────────────────────────────────────────────────────────────────

export type BoardProps<Puzzle, Move> = {
  puzzle: Puzzle;
  /** The moves made so far. They live with whoever renders the board. */
  moves: Move[];
  /** Adds the player's next move. */
  onMove: (move: Move) => void;
  /** Adds several moves at once: giving up fills the tries that are left. */
  onMoves: (moves: Move[]) => void;
  /** Tries allowed, when the host sets them (an expedition); the game's own otherwise. */
  tries?: number;
  /** The current year: the latest a year dial allows. */
  year: number;
  /** The line above the title: "No. 12 — Today's dig", "Stage 3 of 8 — Dig Site". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: ReactNode;
};

export type StatTile = { label: string; value: number | string };

type Translate<Key> = (key: Key, vars?: { [name: string]: string | number }) => string;

export type GameBoardOf<Puzzle, Move, Saved, Key extends string> = {
  data: GameDataOf<Puzzle, Move, Saved>;
  /** One puzzle on screen. */
  Board: ComponentType<BoardProps<Puzzle, Move>>;
  /** The game's own strings, in every language. */
  messages: { [locale in Locale]: { [key in Key]: string } };
  /** The words of the daily page, read from `messages`. */
  daily: (t: Translate<Key>) => {
    /** After the puzzle number: "Today's dig". */
    kicker: string;
    /** The rules, one short line each. */
    help: string[];
    /** Overrides "Next puzzle in". */
    nextLabel?: string;
  };
  /** The spoiler-free result players paste into chats; `url` is the game's address. */
  share: (result: { day: number; puzzle: Puzzle; moves: Move[]; locale: Locale; url: string }) => string;
  /** The statistics panel: how many puzzles are finished, and the tiles to show. */
  stats: (
    save: GameSave<Saved>,
    today: number,
    words: { t: Translate<Key>; site: Translate<"statPlayed" | "statStreak" | "statLongest"> },
  ) => { played: number; tiles: StatTile[] };
};

/** A game's board, with its own types set aside — and the game as the daily page shows it. */
export type GameBoard = GameBoardOf<unknown, unknown, unknown, string> & {
  data: GameData;
  /** Today's puzzle, ready to play (see platform/board.tsx). */
  Screen: ComponentType;
};
