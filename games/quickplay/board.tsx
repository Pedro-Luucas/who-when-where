"use client";

import { translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { PickBoard } from "../engines/pick";
import { pickScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { answersOf, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";
import { ByGame, fromLine, questionRounds } from "./rounds";

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const answers = answersOf(puzzle);
  const rounds = questionRounds(puzzle, locale, (question, _, words) => fromLine(question, words));

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(pickScore(answers, moves).points))}
      answer={(tally) => t("answer", { n: tally.correct, total: rounds.length })}
      after={<ByGame questions={puzzle} moves={moves} locale={locale} />}
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
