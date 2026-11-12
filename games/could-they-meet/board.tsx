"use client";

import { PickBoard, type PickRound } from "../engines/pick";
import { Lifelines, PersonCard } from "../engines/parts";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import { translator, useLocale, type Locale } from "@/lib/i18n";
import type { Notable } from "@/lib/notables";
import { useShellT } from "@/lib/shell-messages";
import data, { answersOf, gapOf, metOf, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

const noteOf = (person: Notable, locale: Locale) =>
  [person.field[locale], person.citizenship?.[locale]].filter(Boolean).join(" · ");

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);

  const rounds: PickRound[] = puzzle.pairs.map(([a, b]) => {
    const gap = gapOf(a, b);
    const met = metOf([a, b]);
    return {
      key: `${a.id}+${b.id}`,
      eyebrow: t("eyebrow"),
      prompt: t("prompt", { a: a.name[locale], b: b.name[locale] }),
      scene: (answered) =>
        answered ? (
          <Lifelines
            label={t("lives")}
            locale={locale}
            overlap
            lives={[a, b].map((person) => ({
              id: person.id,
              name: person.name[locale],
              born: person.born.year,
              died: person.died.year,
            }))}
          />
        ) : (
          <div className="people-pair">
            <PersonCard name={a.name[locale]} note={noteOf(a, locale)} />
            <PersonCard name={b.name[locale]} note={noteOf(b, locale)} />
          </div>
        ),
      options: [
        { id: "yes", label: t("yes") },
        { id: "no", label: t("no") },
      ],
      answer: met ? "yes" : "no",
      reveal: met ? (gap === -1 ? t("metOne") : t("met", { n: -gap })) : t("missed", { n: gap }),
      review: `${a.name[locale]} · ${b.name[locale]}`,
    };
  });

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      layout="binary"
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(pickScore(answersOf(puzzle), moves).points))}
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
