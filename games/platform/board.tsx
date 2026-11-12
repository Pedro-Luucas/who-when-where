"use client";

import { Daily } from "@/components/daily";
import { GamePanels } from "@/components/game-panels";
import { ResultActions } from "@/components/result-footer";
import { useDayNumber } from "@/lib/clock";
import { yearOfDay } from "@/lib/daily";
import { translator, useLocale, useSiteT } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import type { GameSlug } from "../registry";
import type { GameDefinition } from "./definition";
import { GameFrameProvider } from "./frame";
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
    return (
      <Daily>
        {(day, archive) => (
          <Play key={`${day}${archive ? ":archive" : ""}`} day={day} archive={archive} definition={definition} board={erased} />
        )}
      </Daily>
    );
  }
  return { ...erased, Screen };
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Whether a saved record is a finished puzzle. */
function finished(data: GameData, record: unknown): boolean {
  try {
    return record !== undefined && data.resultOf(record) !== null;
  } catch {
    return false;
  }
}

type PlayProps = { day: number; archive: boolean; definition: GameDefinition<GameSlug>; board: Board };

function Play({ day, archive, definition, board }: PlayProps) {
  const { data, Board } = board;
  const daily = useGameSave<unknown>(definition);
  const shelf = useGameSave<unknown>(definition, "archive");
  const today = useDayNumber();
  const locale = useLocale();
  const site = useSiteT();
  const shell = useShellT();
  const t = translator(board.messages, locale);
  const words = board.daily(t);

  // A past day finished on the day stays that record: the archive shows it, never replays it.
  // Any other past day is played afresh on the archive shelf.
  const onShelf = archive && !finished(data, daily[0].days[day]);
  const [save, setSave] = onShelf ? shelf : daily;
  const [dailySave, setDailySave] = daily;

  // A saved record names its puzzle, so a roster change can't reassign it.
  const stored = save.days[day];
  const kept = stored === undefined ? undefined : data.puzzleOfRecord(stored);
  const puzzle = kept ?? data.puzzleForDay(day);
  const soFar = kept === undefined ? [] : movesOf<unknown>(definition, stored);
  // The statistics are the daily puzzles', as they stand today.
  const stats = board.stats(dailySave, archive ? today : day, { t, site });

  function moves(next: unknown[]) {
    if (!next.length) return;
    setSave((previous) => {
      const before = previous.days[day];
      const played = before === undefined ? undefined : data.puzzleOfRecord(before);
      // Only a record of this very puzzle is carried on: a stale one is replaced, never mixed in.
      const carried =
        played !== undefined && sameIds(data.idsOf(played), data.idsOf(puzzle)) ? movesOf<unknown>(definition, before) : [];
      return { ...previous, days: { ...previous.days, [day]: data.recordOf(puzzle, [...carried, ...next]) } };
    });
  }

  return (
    <GameFrameProvider
      value={{ slug: definition.slug, title: definition.title, family: definition.family, daily: true }}
    >
      <Board
        puzzle={puzzle}
        moves={soFar}
        onMove={(next) => moves([next])}
        onMoves={moves}
        year={yearOfDay(day)}
        label={`${site("puzzleNo", { n: day })} — ${archive ? shell("archiveKicker") : words.kicker}`}
      >
        <ResultActions
          game={definition.slug}
          archive={archive}
          shareText={(url) => board.share({ day, puzzle, moves: soFar, locale, url })}
          nextLabel={words.nextLabel}
        />
      </Board>
      <GamePanels
        game={definition.slug}
        help={words.help}
        seenHelp={dailySave.seenHelp}
        onSeenHelp={() => setDailySave((previous) => ({ ...previous, seenHelp: true }))}
        played={stats.played}
        tiles={stats.tiles}
      />
    </GameFrameProvider>
  );
}
