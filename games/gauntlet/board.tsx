"use client";

import { translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { PickBoard } from "../engines/pick";
import { pickScore, tallyPicks, type PickTally } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import { ByGame, questionRounds, sourceTitle } from "../quickplay/rounds";
import data, { LEVELS, LIVES, answersOf, levelAt, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

/** The level the run got to: that of the last question answered (the first, before any). */
const levelReached = (tally: PickTally) => levelAt(Math.max(0, tally.played - 1));

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const answers = answersOf(puzzle);
  const rounds = questionRounds(puzzle, locale, (question, i) =>
    t("levelFrom", { level: levelAt(i), game: sourceTitle(question) }),
  );
  const score = pickScore(answers, moves, LIVES);
  const tally = tallyPicks(answers, moves, LIVES);

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      lives={LIVES}
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(score.points))}
      answer={(tally) =>
        tally.correct === rounds.length
          ? t("answerAll", { n: tally.correct })
          : t("answer", { level: levelReached(tally), n: tally.correct })
      }
      stats={[{ label: t("level"), value: `${levelReached(tally)}/${LEVELS}` }]}
      after={<ByGame questions={puzzle} moves={moves} lives={LIVES} locale={locale} />}
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
  share({ day, puzzle, moves, locale, url }) {
    const answers = answersOf(puzzle);
    const t = translator(MESSAGES, locale);
    const level = levelReached(tallyPicks(answers, moves, LIVES));
    return shareLines(
      definition.title,
      day,
      pickScore(answers, moves, LIVES).points,
      `${t("level")} ${level} · ${pickSquares(answers, moves, LIVES)}`,
      url,
    );
  },
});
