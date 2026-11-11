import { dealFrom } from "../platform/deal";
import { defineData } from "../platform/types";
import { definition } from "./definition";
import { PEOPLE, personById, personForDay, type Person } from "./people";
import { scoreOf, type Guess } from "./rules";
import { isComplete, resultOf, type DayRecord } from "./store";

/** Who When Where without its interface: the roster, the scoring, what a finished life reveals. */
export default defineData<Person, Guess, DayRecord>(definition.slug, {
  puzzleForDay: personForDay,
  deal: dealFrom(PEOPLE.map((person) => person.id)),
  puzzleOf: ([id]) => personById(id),
  puzzleOfRecord: (record) => personById(record.personId),
  idsOf: (person) => [person.id],
  recordOf: (person, guesses) => ({ personId: person.id, guesses }),
  score: (_person, guesses) => scoreOf(guesses),
  resultOf,
  answer: (person, locale) => person.name[locale],
  discover(record, day) {
    const person = personById(record.personId);
    if (!person || !isComplete(record)) return [];
    return [{ kind: "person", id: person.id, day, name: person.name, place: person.birth.place, wiki: person.wiki }];
  },
  totals: { person: PEOPLE.length },
});
