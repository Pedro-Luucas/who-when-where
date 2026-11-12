import { seededShuffle } from "@/lib/daily";
import { EVENTS, eventById, type HistoryEvent } from "../first-to-last/events";
import { defineSetData } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { definition } from "./definition";

// Earlier or Later without its interface: a chain of moments from history
// (First to Last's events). Each round asks whether the next one happened
// before or after the one on the table; the run ends at the third miss.

export const ROUNDS = 20;
export const LIVES = 3;

/** The events in the order they come up: round n compares event n + 1 with event n. */
export type Puzzle = HistoryEvent[];

export const answersOf = (events: Puzzle): string[] =>
  events.slice(1).map((event, i) => (event.year < events[i].year ? "earlier" : "later"));

function dealChain(seed: string): Puzzle {
  const chain: HistoryEvent[] = [];
  const left = seededShuffle(EVENTS, seed);
  while (chain.length < ROUNDS + 1 && left.length) {
    const last = chain.at(-1);
    // Never two moments in the same year, and never two approximate dates side by side.
    const at = left.findIndex((event) => !last || (event.year !== last.year && !(event.circa && last.circa)));
    if (at < 0) break;
    chain.push(...left.splice(at, 1));
  }
  return chain;
}

function fromIds(ids: string[]): Puzzle | undefined {
  const events = ids.map(eventById);
  if (events.length < 2 || events.some((event) => event === undefined)) return undefined;
  return events as HistoryEvent[];
}

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealChain(`${definition.slug}:day:${day}`),
  deal: (seed) => dealChain(`${definition.slug}:${seed}`),
  fromIds,
  idsOf: (events) => events.map((event) => event.id),
  score: (events, moves) => pickScore(answersOf(events), moves, LIVES),
  answer: (events, locale) => events[0]?.name[locale] ?? "",
});
