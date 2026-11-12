"use client";

import type { Country } from "@/lib/countries";
import { FACTS_SOURCE } from "@/lib/geo-data";
import { formatNumber, numberLocale, translator, useLocale, type Locale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { Flag, SourceLine } from "../engines/parts";
import { PickBoard, type PickRound } from "../engines/pick";
import { pickScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { LIVES, answerOf, answersOf, valueOf, type Measure, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

type T = ReturnType<typeof translator<(typeof MESSAGES)["en"]>>;

/** "214 million", "8,515,767 km²", "US$ 9,280", "76.2 years". */
function formatValue(value: number, measure: Measure, locale: Locale, t: T): string {
  const compact = (n: number) =>
    new Intl.NumberFormat(numberLocale(locale), { notation: "compact", maximumFractionDigits: 1 }).format(n);
  switch (measure) {
    case "population":
      return compact(value);
    case "area":
      return t("unitKm2", { n: formatNumber(Math.round(value), locale) });
    case "gdpPerCapita":
      return t("unitUsd", { n: formatNumber(Math.round(value), locale) });
    case "lifeExpectancy":
      return t("unitYears", { n: new Intl.NumberFormat(numberLocale(locale), { maximumFractionDigits: 1 }).format(value) });
    default:
      return t("unitPercent", { n: new Intl.NumberFormat(numberLocale(locale), { maximumFractionDigits: 1 }).format(value) });
  }
}

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const answers = answersOf(puzzle);
  const shown = (country: Country, measure: Measure) => formatValue(valueOf(country, measure) ?? 0, measure, locale, t);

  const rounds: PickRound[] = puzzle.map((round) => ({
    key: `${round.measure}:${round.a.id}:${round.b.id}`,
    eyebrow: `${t("eyebrow")} · ${t(`measure_${round.measure}`)}`,
    prompt: t(`prompt_${round.measure}`),
    options: [round.a, round.b].map((country) => ({
      id: country.id,
      label: country.name[locale],
      media: <Flag id={country.id} />,
      fact: shown(country, round.measure),
    })),
    answer: answerOf(round),
    reveal: t("reveal", {
      a: round.a.name[locale],
      va: shown(round.a, round.measure),
      b: round.b.name[locale],
      vb: shown(round.b, round.measure),
    }),
    review: `${round.a.name[locale]} · ${round.b.name[locale]}`,
  }));

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      lives={LIVES}
      layout="pair"
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(pickScore(answers, moves, LIVES).points))}
      answer={(tally) => t("answer", { n: tally.correct, total: rounds.length })}
      after={<SourceLine label={t("source")} name={t("sourceName")} href={FACTS_SOURCE.url} licence={FACTS_SOURCE.licence} />}
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
    return shareLines(definition.title, day, pickScore(answers, moves, LIVES).points, pickSquares(answers, moves, LIVES), url);
  },
});
