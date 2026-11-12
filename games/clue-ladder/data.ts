import { dailyIndex, seededRandom } from "@/lib/daily";
import { distanceKm } from "@/lib/geo";
import type { Locale } from "@/lib/i18n";
import { NOTABLES, notableById, type Notable } from "@/lib/notables";
import { defineSetData, pickOne } from "../engines/kit";
import { ladderScore } from "../engines/rules";
import { definition } from "./definition";

// Clue Ladder without its interface: one hidden person and six guesses. Each
// miss opens the next clue: century, field, how long they lived, a famous
// contemporary, what they are known for, initials and dates. No clue names a
// country, a people or a place (scripts/check-giveaways.mjs checks).

export const MAX_GUESSES = 6;

/** People with enough known about them for six clues. */
export const PLAYABLE = NOTABLES.filter((person) => person.citizenship || person.born.place.country);
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

export type Clue = { key: "century" | "field" | "lifespan" | "contemporary" | "also" | "known" | "died" | "initials"; text: string };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^\p{Lu}/u.test(word))
    .map((word) => `${word[0]}.`)
    .join(" ");

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Years lived; historical numbering has no year 0. */
export const yearsLived = (person: Notable) =>
  person.died.year - person.born.year - (person.born.year < 0 && person.died.year > 0 ? 1 : 0);

/** How many years two lives shared. */
const shared = (a: Notable, b: Notable) => Math.min(a.died.year, b.died.year) - Math.max(a.born.year, b.born.year);

/** Contemporaries are picked from people born at least this far away, so they say when, not where. */
const FAR_KM = 2500;

/**
 * The best known people alive at the same time as `person` for at least 15
 * years, most famous first: born far from them and in other fields where
 * there are enough, else anyone of their time (the roster is thin in the
 * ancient world). Names that name a place (Joan of Arc) are left out.
 */
export function contemporariesOf(person: Notable): Notable[] {
  const alive = NOTABLES.filter(
    (other) => other.id !== person.id && !other.placeInName && shared(person, other) >= 15,
  ).sort((a, b) => b.fame - a.fame || a.id.localeCompare(b.id));
  const far = alive.filter((other) => distanceKm(other.born.place, person.born.place) >= FAR_KM);
  const farOtherField = far.filter((other) => other.field.en !== person.field.en);
  if (farOtherField.length >= 2) return farOtherField;
  return far.length >= 2 ? far : [...far, ...alive.filter((other) => !far.includes(other))];
}

/** What they are known for: a work, or a line on them — unless that only repeats their field. */
function knownFor(person: Notable, locale: Locale): string | null {
  if (person.work) return person.work[locale];
  const description = person.description[locale];
  return description && !same(description, person.field[locale]) ? description : null;
}

/** The six clues, vaguest first. */
export function cluesOf(person: Notable, locale: Locale, years: string): Clue[] {
  const lived = yearsLived(person);
  const [first, second] = contemporariesOf(person);
  const known = knownFor(person, locale);
  const died: Clue = { key: "died", text: centuryOf(person.died.year, locale) };
  return [
    { key: "century", text: centuryOf(person.born.year, locale) },
    { key: "field", text: person.field[locale] },
    { key: "lifespan", text: locale === "pt" ? `${lived} anos` : `${lived} years` },
    first ? { key: "contemporary", text: first.name[locale] } : died,
    known
      ? { key: "known", text: known }
      : second
        ? { key: "also", text: second.name[locale] }
        : first
          ? died
          : { key: "known", text: person.description[locale] || "—" },
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
