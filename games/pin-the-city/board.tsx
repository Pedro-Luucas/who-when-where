"use client";

import { countryById } from "@/lib/countries";
import { formatNumber, translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, roundSquares, shareLines } from "../engines/kit";
import { PinBoard, type PinRound } from "../engines/pin";
import { VIEWS } from "../engines/regions";
import { isPinMove, roundsScore, toPinMove } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { judge, walkOf, type Move, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, Move>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const kmText = (km: number) => (km <= 25 ? t("spotOn") : t("km", { km: formatNumber(Math.round(km), locale) }));

  const rounds: PinRound[] = puzzle.cities.map((city) => {
    const country = countryById(city.country)?.name[locale] ?? "";
    return {
      key: city.id,
      // Only the city: its country would give the answer away.
      eyebrow: t(city.capital ? "eyebrowCapital" : "eyebrow"),
      prompt: t("prompt", { city: city.name[locale] }),
      target: city,
      answer: `${city.name[locale]}, ${country}`,
      view: VIEWS[puzzle.set],
    };
  });

  return (
    <PinBoard<Move>
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      tries={1}
      judge={(round, move) => judge(puzzle, round, move)}
      resolve={async (point) => toPinMove(point)}
      describe={(round, move, judged) => {
        const at = isPinMove(move) ? { lat: move[0], lon: move[1] } : puzzle.cities[round];
        return {
          // The pin not yet locked in can be dragged to fine-tune it.
          marker: { ...at, kind: "guess", draggable: !judged },
          text: judged ? kmText(judge(puzzle, round, move).km) : t("yourPin"),
        };
      }}
      summary={(round, walk) => {
        const last = walk.tries.at(-1);
        return last ? kmText(judge(puzzle, round, last.move).km) : shell("gaveUp");
      }}
      nothingHere={t("nothing")}
      label={label}
      lead={t("lead")}
      headline={(points) => shell(headlineKey(points))}
    >
      {children}
    </PinBoard>
  );
}

export default defineSetBoard<Puzzle, Move, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const walk = walkOf(puzzle, moves);
    const squares = roundSquares(walk.rounds);
    return shareLines(definition.title, day, roundsScore(walk.shares, puzzle.cities.length, walk.over).points, squares, url);
  },
});
