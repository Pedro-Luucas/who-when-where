"use client";

import { WorldMap, useMapLabels, type MapMarker } from "@/components/world-map";
import type { LatLon } from "@/lib/geo";
import { formatYear, translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { headlineKey, pickSquares, shareLines } from "../engines/kit";
import { PickBoard, type PickRound } from "../engines/pick";
import { pickScore } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { answersOf, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

/** A box around a point, so the map frames the region rather than the whole world. */
const around = ({ lat, lon }: LatLon, degrees = 12): LatLon[] => [
  { lat: Math.max(-70, lat - degrees), lon: lon - degrees * 1.4 },
  { lat: Math.min(75, lat + degrees), lon: lon + degrees * 1.4 },
];

function Board({ puzzle, moves, onMove, onMoves, label, children }: BoardProps<Puzzle, string>) {
  const locale = useLocale();
  const shell = useShellT();
  const mapLabels = useMapLabels();
  const t = translator(MESSAGES, locale);
  const answers = answersOf(puzzle);

  const rounds: PickRound[] = puzzle.rounds.map(({ answer, options }) => {
    const place = answer.born.place;
    const placeName = place.name[locale];
    return {
      key: options.map((person) => person.id).join("."),
      eyebrow: t("eyebrow", { country: place.country?.[locale] ?? "" }),
      prompt: t("prompt", { place: placeName }),
      scene: (answered) => {
        const markers: MapMarker[] = [{ lat: place.lat, lon: place.lon, kind: "answer", label: placeName }];
        if (answered) {
          for (const person of options) {
            if (person.id === answer.id) continue;
            markers.push({ lat: person.born.place.lat, lon: person.born.place.lon, kind: "ghost", label: person.name[locale] });
          }
        }
        return (
          <WorldMap
            markers={markers}
            focus={answered ? markers : around(place)}
            labels={mapLabels}
            ariaLabel={t("mapAria", { place: placeName })}
          />
        );
      },
      options: options.map((person) => ({
        id: person.id,
        label: person.name[locale],
        sub: person.field[locale],
        fact: `${person.born.place.name[locale]} · ${formatYear(person.born.year, locale)}`,
      })),
      answer: answer.id,
      reveal: t("reveal", { name: answer.name[locale], place: placeName, year: formatYear(answer.born.year, locale) }),
      review: placeName,
    };
  });

  return (
    <PickBoard
      game={definition.slug}
      rounds={rounds}
      moves={moves}
      onMove={onMove}
      onMoves={onMoves}
      lives={puzzle.lives}
      label={label}
      lead={t("lead")}
      headline={() => shell(headlineKey(pickScore(answers, moves, puzzle.lives).points))}
      answer={(tally) =>
        puzzle.lives ? t("answerSurvival", { n: tally.correct }) : t("answer", { n: tally.correct, total: rounds.length })
      }
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
    return shareLines(definition.title, day, pickScore(answers, moves, puzzle.lives).points, pickSquares(answers, moves, puzzle.lives), url);
  },
});
