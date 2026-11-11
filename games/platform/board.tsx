"use client";

import { Daily } from "@/components/daily";
import { GamePanels } from "@/components/game-panels";
import { ResultActions } from "@/components/result-footer";
import { yearOfDay } from "@/lib/daily";
import { translator, useLocale, useSiteT } from "@/lib/i18n";
import type { GameSlug } from "../registry";
import type { GameDefinition } from "./definition";
import { movesOf, useGameSave } from "./store";
import type { GameBoard, GameBoardOf, GameData } from "./types";

// The daily page of every game: today's puzzle on the game's board, saved as
// it is played, with sharing, the way to the next puzzle, the rules and the
// statistics around it. A game only says what is its own (see GameBoardOf).

type Board = Omit<GameBoard, "Screen">;

/** Declares a game's board, and builds its daily page from it. */
export function defineBoard<Puzzle, Move, Saved, Key extends string>(
  definition: GameDefinition<GameSlug>,
  board: Omit<GameBoardOf<Puzzle, Move, Saved, Key>, "data"> & { data: GameData },
): GameBoard {
  const erased = board as unknown as Board;
  function Screen() {
    // Keyed by day: at midnight the next puzzle starts from a clean slate.
    return <Daily>{(day) => <Play key={day} day={day} definition={definition} board={erased} />}</Daily>;
  }
  return { ...erased, Screen };
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

function Play({ day, definition, board }: { day: number; definition: GameDefinition<GameSlug>; board: Board }) {
  const { data, Board } = board;
  const [save, setSave] = useGameSave<unknown>(definition);
  const locale = useLocale();
  const site = useSiteT();
  const t = translator(board.messages, locale);
  const words = board.daily(t);

  // A saved record names its puzzle, so a roster change can't reassign it.
  const stored = save.days[day];
  const kept = stored === undefined ? undefined : data.puzzleOfRecord(stored);
  const puzzle = kept ?? data.puzzleForDay(day);
  const moves = kept === undefined ? [] : movesOf<unknown>(definition, stored);
  const stats = board.stats(save, day, { t, site });

  function move(next: unknown) {
    setSave((previous) => {
      const before = previous.days[day];
      const played = before === undefined ? undefined : data.puzzleOfRecord(before);
      // Only a record of this very puzzle is carried on: a stale one is replaced, never mixed in.
      const carried =
        played !== undefined && sameIds(data.idsOf(played), data.idsOf(puzzle)) ? movesOf<unknown>(definition, before) : [];
      return { ...previous, days: { ...previous.days, [day]: data.recordOf(puzzle, [...carried, next]) } };
    });
  }

  return (
    <>
      <Board
        puzzle={puzzle}
        moves={moves}
        onMove={move}
        year={yearOfDay(day)}
        label={`${site("puzzleNo", { n: day })} — ${words.kicker}`}
      >
        <ResultActions
          game={definition.slug}
          shareText={(url) => board.share({ day, puzzle, moves, locale, url })}
          nextLabel={words.nextLabel}
        />
      </Board>
      <GamePanels
        game={definition.slug}
        help={words.help}
        seenHelp={save.seenHelp}
        onSeenHelp={() => setSave((previous) => ({ ...previous, seenHelp: true }))}
        played={stats.played}
        tiles={stats.tiles}
      />
    </>
  );
}
