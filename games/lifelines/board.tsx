"use client";

import { formatYear, translator, useLocale } from "@/lib/i18n";
import { SQUARE, shareLines } from "../engines/kit";
import { OrderBoard } from "../engines/order";
import { Lifelines, Monogram, lifeYears } from "../engines/parts";
import { inPlace, orderScore, type OrderAttempt } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { MAX_TRIES, SIZE, truthOf, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

function Board({ puzzle, moves, onMove, onMoves, tries = MAX_TRIES, label, children }: BoardProps<Puzzle, OrderAttempt>) {
  const locale = useLocale();
  const t = translator(MESSAGES, locale);
  const truth = truthOf(puzzle);
  const years = puzzle.map((person) => person.born.year);

  return (
    <OrderBoard
      game={definition.slug}
      items={puzzle.map((person) => ({
        id: person.id,
        name: person.name[locale],
        note: [person.field[locale], person.citizenship?.[locale]].filter(Boolean).join(" · "),
        value: lifeYears(person.born.year, person.died.year, locale),
        media: <Monogram name={person.name.en} />,
      }))}
      truth={truth}
      attempts={moves}
      onAttempt={onMove}
      onAttempts={onMoves}
      max={tries}
      label={label}
      lead={t("lead")}
      eyebrow={t("eyebrow")}
      prompt={t("prompt")}
      ends={{ first: t("first"), last: t("last") }}
      headline={(solved, used, placed) =>
        solved ? (used === 1 ? t("flawless") : t("solvedIn", { n: used })) : t("lost", { n: placed })
      }
      answer={t("answer", {
        from: formatYear(Math.min(...years), locale),
        to: formatYear(Math.max(...years), locale),
      })}
      after={
        <Lifelines
          label={t("lives")}
          locale={locale}
          lives={truth.flatMap((id) => {
            const person = puzzle.find((entry) => entry.id === id);
            return person ? [{ id, name: person.name[locale], born: person.born.year, died: person.died.year }] : [];
          })}
        />
      }
    >
      {children}
    </OrderBoard>
  );
}

export default defineSetBoard<Puzzle, OrderAttempt, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const truth = truthOf(puzzle);
    const rows = moves.map((attempt) => attempt.map((id, i) => (id === truth[i] ? SQUARE.hit : SQUARE.miss)).join(""));
    const placed = moves.at(-1) ? inPlace(moves.at(-1)!, truth) : 0;
    const head = placed === SIZE ? `${moves.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
    return shareLines(`${definition.title} ${head}`, day, orderScore(truth, moves, MAX_TRIES).points, rows.join("\n"), url);
  },
});
