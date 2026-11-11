import { formatYear } from "@/lib/i18n";
import { defineData } from "../platform/types";
import { definition } from "./definition";
import { EVENTS, PUZZLE_SIZE, eventById, eventsForDay, eventsForSeed, type HistoryEvent } from "./events";
import { isOver, scoreOf, truthOf, type Attempt } from "./rules";
import { resultOf, type DayRecord } from "./store";

/** The events the ids name, in that (lettered) order — unless one of them has left the roster. */
function eventsOf(ids: string[]): HistoryEvent[] | undefined {
  const events = ids.map(eventById);
  if (events.length !== PUZZLE_SIZE || events.some((event) => event === undefined)) return undefined;
  return events as HistoryEvent[];
}

/** First to Last without its interface: the events, the scoring, what a finished line-up reveals. */
export default defineData<HistoryEvent[], Attempt, DayRecord>(definition.slug, {
  puzzleForDay: eventsForDay,
  deal: (seed, count) => eventsForSeed(seed, count).map((events) => events.map((event) => event.id)),
  puzzleOf: eventsOf,
  puzzleOfRecord: (record) => eventsOf(record.ids),
  idsOf: (events) => events.map((event) => event.id),
  recordOf: (events, attempts) => ({ ids: events.map((event) => event.id), attempts }),
  score: scoreOf,
  resultOf,
  answer(events, locale) {
    const years = events.map((event) => event.year);
    return years.length ? `${formatYear(Math.min(...years), locale)} → ${formatYear(Math.max(...years), locale)}` : "";
  },
  discover(record, day) {
    const events = eventsOf(record.ids);
    if (!events || !isOver(record.attempts, truthOf(events))) return [];
    return events.map((event) => ({ kind: "event", id: event.id, day, name: event.name, place: event }));
  },
  totals: { event: EVENTS.length },
});
