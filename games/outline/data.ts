import { countryById, type Country } from "@/lib/countries";
import { dealFrom } from "../platform/deal";
import { defineData } from "../platform/types";
import { definition } from "./definition";
import { TARGETS, countryForDay, isOver, scoreOf } from "./rules";
import { resultOf, type DayRecord } from "./store";

/** Outline without its interface: the countries, the scoring, what a finished one reveals. */
export default defineData<Country, string, DayRecord>(definition.slug, {
  puzzleForDay: countryForDay,
  deal: dealFrom(TARGETS.map((country) => country.id)),
  puzzleOf: ([id]) => countryById(id),
  puzzleOfRecord: (record) => countryById(record.countryId),
  idsOf: (country) => [country.id],
  recordOf: (country, guesses) => ({ countryId: country.id, guesses }),
  score: (country, guesses, max) => scoreOf(country.id, guesses, max),
  resultOf,
  answer: (country, locale) => country.name[locale],
  discover(record, day) {
    const country = countryById(record.countryId);
    if (!country || !isOver(country.id, record.guesses)) return [];
    return [{ kind: "country", id: country.id, day, name: country.name, place: country, country }];
  },
  totals: { country: TARGETS.length },
});
