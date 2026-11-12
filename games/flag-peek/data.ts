import { dailyIndex, seededRandom, seededShuffle } from "@/lib/daily";
import { COUNTRIES, countryById, type Country } from "@/lib/countries";
import { defineSetData, pickOne } from "../engines/kit";
import { ladderScore } from "../engines/rules";
import { definition } from "./definition";

// Flag Peek without its interface: a country's flag under a grid of tiles.
// A few are lifted at the start; every miss lifts more.

export const MAX_GUESSES = 6;
export const COLUMNS = 8;
export const ROWS = 6;
export const TILES = COLUMNS * ROWS;

/** Tiles lifted with n guesses made (n = 0 … 5); all of them once it is over. */
const LIFTED = [5, 10, 16, 23, 31, 40];

/** How many tiles are lifted after `used` guesses of `max`: fewer guesses start further along. */
export const liftedAfter = (used: number, max: number, over: boolean) =>
  over ? TILES : LIFTED[Math.min(LIFTED.length - 1, used + (MAX_GUESSES - max))];

/** The order a flag's tiles are lifted in: the same for everyone, different for every flag. */
export const tileOrder = (country: Country) => seededShuffle(
  Array.from({ length: TILES }, (_, i) => i),
  `${definition.slug}:${country.id}`,
);

export const NAMEABLE = COUNTRIES.map((country) => ({ id: country.id, name: country.name, also: country.also }));

export default defineSetData<Country, string>(definition.slug, {
  forDay: (day) => COUNTRIES[dailyIndex(COUNTRIES.length, day, definition.slug)],
  deal: (seed) => pickOne(COUNTRIES, seededRandom(`${definition.slug}:${seed}`)),
  fromIds: ([id]) => (id === undefined ? undefined : countryById(id)),
  idsOf: (country) => [country.id],
  score: (country, guesses, tries = MAX_GUESSES) => ladderScore(country.id, guesses, tries),
  answer: (country, locale) => country.name[locale],
  discover: (country, day) => [{ kind: "country", id: country.id, day, name: country.name, place: country, country }],
  // Every country has a flag, so this game can turn up any of them.
  totals: { country: COUNTRIES.length },
});
