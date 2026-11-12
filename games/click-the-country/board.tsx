"use client";

import { countryById } from "@/lib/countries";
import { translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { countryAt } from "../engines/hit-test";
import { headlineKey, roundSquares, shareLines } from "../engines/kit";
import { PinBoard, type PinRound } from "../engines/pin";
import { VIEWS } from "../engines/regions";
import { roundsScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { MAX_TRIES, judge, walkOf, type Move, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

function Board({ puzzle, moves, onMove, onMoves, tries = MAX_TRIES, label, children }: BoardProps<Puzzle, Move>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);

  const rounds: PinRound[] = puzzle.countries.map((country) => {
    return {
      key: country.id,
      // No continent: that would halve the search.
      eyebrow: t("eyebrow"),
      prompt: t("prompt", { country: country.name[locale] }),
      target: country,
      answer: country.name[locale],
      answerRegions: country.shapes.map((shape) => ({ shape, tone: "answer" })),
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
      tries={tries}
      judge={(round, move, attempt) => judge(puzzle, round, move, attempt, tries)}
      resolve={(point) => countryAt(point)}
      describe={(round, move, judged) => {
        const country = countryById(move) ?? puzzle.countries[round];
        const tone = judged === null ? "near" : judged.hit ? "answer" : "off";
        return {
          marker: { lat: country.lat, lon: country.lon, kind: "guess", tone: judged?.hit ? undefined : "off" },
          regions: country.shapes.map((shape) => ({ shape, tone })),
          text: t("thatIs", { country: country.name[locale] }),
        };
      }}
      summary={(_, walk) => {
        const at = walk.tries.findIndex((entry) => entry.judged.hit);
        return at < 0 ? (walk.tries.length ? t("notFound") : shell("gaveUp")) : at === 0 ? t("foundFirst") : t("found", { n: at + 1 });
      }}
      nothingHere={t("sea")}
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
    return shareLines(definition.title, day, roundsScore(walk.shares, puzzle.countries.length, walk.over).points, roundSquares(walk.rounds), url);
  },
});
