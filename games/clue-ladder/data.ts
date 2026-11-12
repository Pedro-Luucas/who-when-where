import { dailyIndex, seededRandom } from "@/lib/daily";
import type { Locale } from "@/lib/i18n";
import { NOTABLES, notableById, type Notable } from "@/lib/notables";
import { defineSetData, pickOne } from "../engines/kit";
import { ladderScore } from "../engines/rules";
import { definition } from "./definition";

// Clue Ladder without its interface: one hidden person and six guesses. Each
// miss opens the next clue: century, field, country, birthplace, what they
// are known for, initials and dates.

export const MAX_GUESSES = 6;

/** People with enough known about them for six clues. */
const PLAYABLE = NOTABLES.filter((person) => person.citizenship || person.born.place.country);
/** The daily answers: the best known of them. */
const DAILY = PLAYABLE.filter((person) => person.fame >= 90);
const PRACTICE = PLAYABLE.filter((person) => person.fame >= 50);

/** Everyone a player can name: the whole roster. */
export const NAMEABLE = NOTABLES.map((person) => ({ id: person.id, name: person.name }));

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX"];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "19th century", "século XIX", "5th century BC". */
export function centuryOf(year: number, locale: Locale): string {
  const century = Math.ceil(Math.abs(year) / 100);
  if (locale === "pt") return `século ${ROMAN[century] ?? century}${year < 0 ? " a.C." : ""}`;
  return `${ordinal(century)} century${year < 0 ? " BC" : ""}`;
}

export type Clue = { key: "century" | "field" | "country" | "born" | "known" | "died" | "initials"; text: string };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^\p{Lu}/u.test(word))
    .map((word) => `${word[0]}.`)
    .join(" ");

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** What they are known for: a work, or a line on them — or, when that only repeats their field, where they died. */
function knownFor(person: Notable, locale: Locale): Clue {
  if (person.work) return { key: "known", text: person.work[locale] };
  const description = person.description[locale];
  if (!same(description, person.field[locale])) return { key: "known", text: description };
  const died = person.died.place;
  if (died) return { key: "died", text: [died.name[locale], died.country?.[locale]].filter(Boolean).join(", ") };
  return { key: "known", text: person.description.en };
}

/** The six clues, vaguest first. */
export function cluesOf(person: Notable, locale: Locale, years: string): Clue[] {
  const place = person.born.place;
  return [
    { key: "century", text: centuryOf(person.born.year, locale) },
    { key: "field", text: person.field[locale] },
    { key: "country", text: (person.citizenship ?? place.country)?.[locale] ?? "—" },
    { key: "born", text: [place.name[locale], place.country?.[locale]].filter(Boolean).join(", ") },
    knownFor(person, locale),
    { key: "initials", text: `${initialsOf(person.name[locale]) || person.name[locale][0]} · ${years}` },
  ];
}

export default defineSetData<Notable, string>(definition.slug, {
  forDay: (day) => DAILY[dailyIndex(DAILY.length, day, definition.slug)],
  deal: (seed) => pickOne(PRACTICE, seededRandom(`${definition.slug}:${seed}`)),
  fromIds: ([id]) => (id === undefined ? undefined : notableById(id)),
  idsOf: (person) => [person.id],
  score: (person, guesses, tries = MAX_GUESSES) => ladderScore(person.id, guesses, tries),
  answer: (person, locale) => person.name[locale],
});
