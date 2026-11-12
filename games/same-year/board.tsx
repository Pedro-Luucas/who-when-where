"use client";

import { formatYear, translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { PickBoard, type PickRound } from "../engines/pick";
import { pickScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { answersOf, sharedYear, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const answers = answersOf(puzzle);

  const rounds: PickRound[] = puzzle.map((round) => ({
    key: round.options.map((moment) => moment.id).join("|"),
    eyebrow: t("eyebrow"),
    prompt: t("prompt"),
    options: round.options.map((moment) => ({
      id: moment.id,
      label: moment.name[locale],
      fact: formatYear(moment.year, locale),
    })),
    answer: round.odd.id,
    reveal: t("reveal", { year: formatYear(sharedYear(round), locale), odd: formatYear(round.odd.year, locale) }),
    review: formatYear(sharedYear(round), locale),
  }));

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      layout="list"
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(pickScore(answers, moves).points))}
      answer={(tally) => t("answer", { n: tally.correct, total: rounds.length })}
    >
      {children}
    </PickBoard>
  );
}

export default defineSetBoard<Puzzle, string, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const answers = answersOf(puzzle);
    return shareLines(definition.title, day, pickScore(answers, moves).points, pickSquares(answers, moves), url);
  },
});
