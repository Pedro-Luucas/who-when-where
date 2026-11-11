import { dealFrom } from "../platform/deal";
import { defineData } from "../platform/types";
import { definition } from "./definition";
import { JOURNEYS, journeyById, journeyForDay, type Journey } from "./journeys";
import { isOver, scoreOf, type Guess } from "./rules";
import { resultOf, type DayRecord } from "./store";

/** Wayfarer without its interface: the roster, the scoring, what a finished journey reveals. */
export default defineData<Journey, Guess, DayRecord>(definition.slug, {
  puzzleForDay: journeyForDay,
  deal: dealFrom(JOURNEYS.map((journey) => journey.id)),
  puzzleOf: ([id]) => journeyById(id),
  puzzleOfRecord: (record) => journeyById(record.journeyId),
  idsOf: (journey) => [journey.id],
  recordOf: (journey, guesses) => ({ journeyId: journey.id, guesses }),
  score: (journey, guesses, max) => scoreOf(journey.id, guesses, max),
  resultOf,
  answer: (journey, locale) => journey.name[locale],
  discover(record, day) {
    const journey = journeyById(record.journeyId);
    if (!journey || !isOver(journey.id, record.guesses)) return [];
    return [
      {
        kind: "journey",
        id: journey.id,
        day,
        name: journey.name,
        place: journey.stops[0],
        route: journey.stops,
        wiki: journey.wiki,
      },
    ];
  },
  totals: { journey: JOURNEYS.length },
});
