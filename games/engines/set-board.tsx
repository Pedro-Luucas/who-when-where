"use client";

import type { ComponentType } from "react";
import type { Locale } from "@/lib/i18n";
import { defineBoard } from "../platform/board";
import type { GameDefinition } from "../platform/definition";
import type { BoardProps, GameBoard, GameData, GameSave } from "../platform/types";
import type { GameSlug } from "../registry";
import { STAT_WORDS, setStats, type SetRecord } from "./kit";

// The board half of an engine game (see kit.ts for the data half): its own
// strings with the statistics words added, the daily page's kicker and
// rules read from them, and the statistics every engine game shows.

type Messages<Key extends string> = { [locale in Locale]: { [key in Key]: string } };

type Spec<Puzzle, Move, Key extends string> = {
  data: GameData;
  Board: ComponentType<BoardProps<Puzzle, Move>>;
  messages: Messages<Key>;
  /** The key of the line after the puzzle number ("Today's run"). */
  kicker: Key;
  /** The keys of the rules, one line each. */
  help: Key[];
  share: (result: { day: number; puzzle: Puzzle; moves: Move[]; locale: Locale; url: string }) => string;
};

export function defineSetBoard<Puzzle, Move, Key extends string>(
  definition: GameDefinition<GameSlug>,
  spec: Spec<Puzzle, Move, Key>,
): GameBoard {
  type All = Key | keyof (typeof STAT_WORDS)["en"];
  const messages = {
    en: { ...STAT_WORDS.en, ...spec.messages.en },
    pt: { ...STAT_WORDS.pt, ...spec.messages.pt },
  } as Messages<All>;
  return defineBoard<Puzzle, Move, SetRecord<Move>, All>(definition, {
    data: spec.data,
    Board: spec.Board,
    messages,
    daily: (t) => ({ kicker: t(spec.kicker), help: spec.help.map((key) => t(key)) }),
    share: spec.share,
    stats: (save: GameSave<SetRecord<Move>>, today, { t, site }) =>
      setStats(save, today, spec.data, { site, average: t("statAverage"), best: t("statBest") }),
  });
}
