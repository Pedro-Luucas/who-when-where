import { seededShuffle } from "@/lib/daily";
import { COUNTRIES, countryById, stepsFrom, type Country } from "@/lib/countries";
import { distanceKm } from "@/lib/geo";
import { CITIES, REGION_NAMES, REGIONS, cityById, factsOf, regionOf, type City, type Region } from "@/lib/geo-data";
import type { Locale } from "@/lib/i18n";
import { NOTABLES, notableById, type Notable } from "@/lib/notables";
import { EVENTS, eventById, type HistoryEvent } from "../first-to-last/events";
import { PLAYABLE as BORN_HERE_PLAYABLE } from "../born-here/data";
import type { GameSlug } from "../registry";

// The question bank Quickplay and Gauntlet share: one question at a time,
// each in the manner of another game on the site, built from that game's
// roster. Pure data, no interface.
//
// A question is named by its id, and the id carries everything needed to
// build it again — what kind it is, the right answer (always the first of
// its choices) and the others — so a saved day comes back exactly as it was
// played even when the generator below changes. The order the choices are
// shown in is a seeded shuffle of the id.
//
// Every generator takes a difficulty from 0 (easy) to 1 (very hard): it sets
// how famous the people and countries are, how close the years and the
// numbers, and how near the wrong answers lie to the right one.

/** The ten kinds of question; Quickplay asks each once. */
export const KINDS = [
  "flag",
  "capital",
  "earlier",
  "bornIn",
  "met",
  "bornFirst",
  "bigger",
  "border",
  "continent",
  "sameYear",
] as const;
export type Kind = (typeof KINDS)[number];

/** The game each kind of question comes from. */
export const KIND_GAME: Record<Kind, GameSlug> = {
  flag: "flag-peek",
  capital: "pin-the-city",
  earlier: "earlier-or-later",
  bornIn: "born-here",
  met: "could-they-meet",
  bornFirst: "lifelines",
  bigger: "higher-or-lower",
  border: "border-chain",
  continent: "click-the-country",
  sameYear: "same-year",
};

export type Measure = "population" | "area";

/** A moment for the odd-one-out: an event, or a famous person's birth or death. */
export type Moment = {
  /** "e:bastille", "b:ada-lovelace", "d:ada-lovelace". */
  id: string;
  year: number;
  event?: HistoryEvent;
  person?: Notable;
  /** Born or died, for a person's moment. */
  what?: "born" | "died";
};

type Base = {
  id: string;
  kind: Kind;
  /** The choices' ids, in the order they are shown. */
  options: string[];
  /** The right choice's id. */
  answer: string;
};

export type Question = Base &
  (
    | { type: "flag"; country: Country; choices: Country[] }
    | { type: "capital"; country: Country; choices: City[] }
    | { type: "capitalOf"; city: City; choices: Country[] }
    | { type: "earlier"; choices: HistoryEvent[] }
    | { type: "bornIn"; person: Notable; choices: Notable[] }
    | { type: "met"; met: boolean; pair: [Notable, Notable] }
    | { type: "bornFirst"; choices: Notable[] }
    | { type: "bigger"; measure: Measure; choices: Country[] }
    | { type: "border"; country: Country; choices: Country[] }
    | { type: "continent"; country: Country; choices: Region[] }
    | { type: "sameYear"; odd: Moment; choices: Moment[] }
  );

// ── Small helpers ───────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
const pick = <T>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];
const shuffle = <T>(items: readonly T[], random: () => number): T[] => seededShuffle(items, String(random()));

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const wordsOf = (...texts: string[]) =>
  texts
    .flatMap((text) => fold(text).split(/[^\p{L}\p{N}]+/u))
    .filter((word) => word.length >= 4 && !["city", "cidade", "saint", "santa", "santo", "republic", "republica"].includes(word));

/** Whether two names share a word, or the start of one ("Brasília", "Brasil"): one would give the other away. */
function namesTouch(a: string[], b: string[]): boolean {
  const left = wordsOf(...a);
  const right = wordsOf(...b);
  return left.some((x) => right.some((y) => x === y || (x.length >= 5 && y.length >= 5 && x.slice(0, 5) === y.slice(0, 5))));
}

/** People this famous at least: from the best known (easy) to the whole roster (hard). */
const minFame = (d: number) => Math.round(lerp(140, 40, d));

/** A window that narrows with difficulty, on a log scale: [easyLow, easyHigh] → [hardLow, hardHigh]. */
function band(d: number, easy: [number, number], hard: [number, number]): [number, number] {
  const log = (a: number, b: number) => Math.exp(lerp(Math.log(a), Math.log(b), d));
  return [log(easy[0], hard[0]), log(easy[1], hard[1])];
}

const within = (value: number, [low, high]: [number, number]) => value >= low && value <= high;

// ── Countries, from the best known to the least ─────────────────────────────

/** By population, biggest first: a rough measure of how well known a country is. */
const BY_FAMILIARITY = [...COUNTRIES].sort(
  (a, b) => (factsOf(b.id)?.population ?? 0) - (factsOf(a.id)?.population ?? 0),
);
const RANK = new Map(BY_FAMILIARITY.map((country, i) => [country.id, i]));

/** The countries a question of difficulty `d` may be about. */
function countryPool(d: number): Country[] {
  const top = Math.round(lerp(45, COUNTRIES.length, d));
  const skip = Math.round(lerp(0, 70, (d - 0.5) * 2));
  return BY_FAMILIARITY.slice(skip, top);
}

const continentOf = (country: Country): Region | undefined => regionOf(country.id);
const sameContinent = (a: Country, b: Country) => continentOf(a) !== undefined && continentOf(a) === continentOf(b);

/** Flags that are (all but) the same: never two of them in one question. */
const TWIN_FLAGS = [
  ["td", "ro"],
  ["mc", "id"],
  ["nl", "lu"],
];
const twins = (a: string, b: string) => TWIN_FLAGS.some((pair) => pair.includes(a) && pair.includes(b));

/**
 * Three wrong countries for `answer`: from its own continent more often the
 * harder the question, and never one that `allowed` rules out.
 */
function wrongCountries(answer: Country, d: number, random: () => number, allowed: (c: Country) => boolean): Country[] | null {
  const chosen: Country[] = [];
  const pool = BY_FAMILIARITY.slice(0, Math.round(lerp(90, COUNTRIES.length, d)));
  for (let slot = 0; slot < 3; slot++) {
    const near = random() < lerp(0.15, 0.95, d);
    const fits = (country: Country) =>
      country.id !== answer.id &&
      !chosen.some((other) => other.id === country.id || twins(other.id, country.id)) &&
      !twins(answer.id, country.id) &&
      allowed(country);
    const candidates = pool.filter((country) => fits(country) && sameContinent(country, answer) === near);
    const fallback = candidates.length ? candidates : COUNTRIES.filter(fits);
    if (!fallback.length) return null;
    chosen.push(pick(fallback, random));
  }
  return chosen;
}

// ── Capitals ────────────────────────────────────────────────────────────────

/** Each country's one capital, where it has exactly one and its name doesn't echo the country's. */
const CAPITAL = new Map<string, City>();
const CAPITALS = new Map<string, City[]>();
for (const city of CITIES) if (city.capital) CAPITALS.set(city.country, [...(CAPITALS.get(city.country) ?? []), city]);
for (const country of COUNTRIES) {
  const cities = CAPITALS.get(country.id);
  if (cities?.length !== 1) continue;
  const [city] = cities;
  if (namesTouch([city.name.en, city.name.pt], [country.name.en, country.name.pt])) continue;
  CAPITAL.set(country.id, city);
}

/** A country's capital cities (most have one), for the facts shown after an answer. */
export const capitalsOf = (countryId: string): City[] => CAPITALS.get(countryId) ?? [];

// ── Moments for the odd one out (Same Year) ─────────────────────────────────

const MOMENTS: Moment[] = [
  ...EVENTS.filter((event) => !event.circa).map((event) => ({ id: `e:${event.id}`, year: event.year, event })),
  ...NOTABLES.filter((person) => person.fame >= 40).flatMap((person) => [
    { id: `b:${person.id}`, year: person.born.year, person, what: "born" as const },
    { id: `d:${person.id}`, year: person.died.year, person, what: "died" as const },
  ]),
];

function momentById(id: string): Moment | undefined {
  const [tag, rest] = [id.slice(0, 2), id.slice(2)];
  if (tag === "e:") {
    const event = eventById(rest);
    return event && { id, year: event.year, event };
  }
  const person = tag === "b:" || tag === "d:" ? notableById(rest) : undefined;
  if (!person) return undefined;
  return tag === "b:"
    ? { id, year: person.born.year, person, what: "born" }
    : { id, year: person.died.year, person, what: "died" };
}

const subjectOf = (moment: Moment) => (moment.person ? `p:${moment.person.id}` : `e:${moment.event!.id}`);
const momentFame = (moment: Moment) => moment.person?.fame ?? 120;

const MOMENTS_BY_YEAR = new Map<number, Moment[]>();
for (const moment of MOMENTS) MOMENTS_BY_YEAR.set(moment.year, [...(MOMENTS_BY_YEAR.get(moment.year) ?? []), moment]);

// ── Building a question from its id ─────────────────────────────────────────

/** The prefix of each type's ids. */
const PREFIX = {
  flag: "fl",
  capital: "ca",
  capitalOf: "co",
  earlier: "ev",
  bornIn: "bh",
  met: "mt",
  bornFirst: "bf",
  bigger: "hl",
  border: "bd",
  continent: "ct",
  sameYear: "sy",
} as const;
type Type = keyof typeof PREFIX;
const TYPE_OF_PREFIX = new Map<string, Type>(Object.entries(PREFIX).map(([type, prefix]) => [prefix, type as Type]));

const KIND_OF_TYPE: Record<Type, Kind> = {
  flag: "flag",
  capital: "capital",
  capitalOf: "capital",
  earlier: "earlier",
  bornIn: "bornIn",
  met: "met",
  bornFirst: "bornFirst",
  bigger: "bigger",
  border: "border",
  continent: "continent",
  sameYear: "sameYear",
};

const allDefined = <T>(items: (T | undefined)[]): items is T[] => items.every((item) => item !== undefined);
const distinct = (ids: string[]) => new Set(ids).size === ids.length;

/** The choices in the order they are shown: the same for everyone, different for every question. */
const orderOf = (ids: string[], id: string) => seededShuffle(ids, `order:${id}`);

/** The question an id names, unless something in it has left the roster. */
export function questionOf(id: string): Question | undefined {
  const at = id.indexOf(":");
  const type = TYPE_OF_PREFIX.get(id.slice(0, at));
  if (at < 0 || type === undefined) return undefined;
  const parts = id.slice(at + 1).split(":");
  const kind = KIND_OF_TYPE[type];
  const list = (text: string | undefined, separator = ",") => (text ? text.split(separator) : []);

  switch (type) {
    case "flag": {
      const ids = list(parts[0]);
      const choices = ids.map(countryById);
      if (ids.length !== 4 || !distinct(ids) || !allDefined(choices)) return undefined;
      return { id, kind, type, country: choices[0], choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "capital": {
      const ids = list(parts[0]);
      const choices = ids.map(cityById);
      if (ids.length !== 4 || !distinct(ids) || !allDefined(choices)) return undefined;
      const country = countryById(choices[0].country);
      if (!country) return undefined;
      return { id, kind, type, country, choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "capitalOf": {
      const city = cityById(parts[0] ?? "");
      const ids = list(parts[1]);
      const choices = ids.map(countryById);
      if (!city || ids.length !== 4 || !distinct(ids) || !allDefined(choices)) return undefined;
      return { id, kind, type, city, choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "earlier": {
      const ids = list(parts[0]);
      const choices = ids.map(eventById);
      if (ids.length !== 2 || !distinct(ids) || !allDefined(choices)) return undefined;
      return { id, kind, type, choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "bornIn": {
      const ids = list(parts[0]);
      const choices = ids.map(notableById);
      if (ids.length !== 4 || !distinct(ids) || !allDefined(choices)) return undefined;
      return { id, kind, type, person: choices[0], choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "met": {
      const answer = parts[0];
      const ids = list(parts[1]);
      const pair = ids.map(notableById);
      if ((answer !== "yes" && answer !== "no") || ids.length !== 2 || !distinct(ids) || !allDefined(pair)) return undefined;
      return { id, kind, type, met: answer === "yes", pair: [pair[0], pair[1]], answer, options: ["yes", "no"] };
    }
    case "bornFirst": {
      const ids = list(parts[0]);
      const choices = ids.map(notableById);
      if (ids.length !== 2 || !distinct(ids) || !allDefined(choices)) return undefined;
      return { id, kind, type, choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "bigger": {
      const measure = parts[0];
      const ids = list(parts[1]);
      const choices = ids.map(countryById);
      if ((measure !== "population" && measure !== "area") || ids.length !== 2 || !distinct(ids) || !allDefined(choices)) {
        return undefined;
      }
      return { id, kind, type, measure, choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "border": {
      const country = countryById(parts[0] ?? "");
      const ids = list(parts[1]);
      const choices = ids.map(countryById);
      if (!country || ids.length !== 4 || !distinct([country.id, ...ids]) || !allDefined(choices)) return undefined;
      return { id, kind, type, country, choices, answer: ids[0], options: orderOf(ids, id) };
    }
    case "continent": {
      const country = countryById(parts[0] ?? "");
      const ids = list(parts[1]);
      const isRegion = (value: string): value is Region => (REGIONS as readonly string[]).includes(value);
      if (!country || ids.length !== 4 || !distinct(ids) || !ids.every(isRegion)) return undefined;
      return { id, kind, type, country, choices: ids, answer: ids[0], options: orderOf(ids, id) };
    }
    case "sameYear": {
      // Moment ids hold a colon of their own: the list is split on "|".
      const ids = list(id.slice(at + 1), "|");
      const choices = ids.map(momentById);
      if (ids.length !== 4 || !distinct(ids) || !allDefined(choices)) return undefined;
      return { id, kind, type, odd: choices[0], choices, answer: ids[0], options: orderOf(ids, id) };
    }
  }
}

// ── Generators ──────────────────────────────────────────────────────────────

/** What a run has already asked about (countries, people, events), so nothing comes up twice. */
export type Used = Set<string>;

type Made = { id: string; subjects: string[] };
type Generator = (d: number, random: () => number, used: Used) => Made | null;

const TRIES = 60;

const freshCountries = (pool: Country[], used: Used) => pool.filter((country) => !used.has(`c:${country.id}`));
const freshPeople = (pool: Notable[], used: Used) => pool.filter((person) => !used.has(`p:${person.id}`));

const flag: Generator = (d, random, used) => {
  const pool = freshCountries(countryPool(d), used);
  if (!pool.length) return null;
  const answer = pick(pool, random);
  const wrong = wrongCountries(answer, d, random, () => true);
  if (!wrong) return null;
  return { id: `${PREFIX.flag}:${[answer, ...wrong].map((c) => c.id).join(",")}`, subjects: [`c:${answer.id}`] };
};

const capital: Generator = (d, random, used) => {
  const pool = freshCountries(countryPool(d), used).filter((country) => CAPITAL.has(country.id));
  if (!pool.length) return null;
  const country = pick(pool, random);
  const subjects = [`c:${country.id}`];
  if (random() < 0.5) {
    // The capital of a country: four cities, all capitals.
    const wrong = wrongCountries(country, d, random, (other) => CAPITAL.has(other.id));
    if (!wrong) return null;
    const cities = [country, ...wrong].map((c) => CAPITAL.get(c.id)!.id);
    return { id: `${PREFIX.capital}:${cities.join(",")}`, subjects };
  }
  // The country of a capital: four countries.
  const city = CAPITAL.get(country.id)!;
  const wrong = wrongCountries(country, d, random, (other) => !namesTouch([city.name.en, city.name.pt], [other.name.en, other.name.pt]));
  if (!wrong) return null;
  return { id: `${PREFIX.capitalOf}:${city.id}:${[country, ...wrong].map((c) => c.id).join(",")}`, subjects };
};

const earlier: Generator = (d, random, used) => {
  const gap = band(d, [250, 3000], [3, 30]);
  const pool = EVENTS.filter((event) => !used.has(`e:${event.id}`));
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const a = pick(pool, random);
    const loose = attempt / TRIES;
    const fits = pool.filter((b) => {
      const years = Math.abs(a.year - b.year);
      if (b.id === a.id || years < 3) return false;
      // An approximate date is only asked against one far from it.
      if ((a.circa || b.circa) && years < 50) return false;
      return within(years, [gap[0] * (1 - loose), gap[1] * (1 + loose * 3)]);
    });
    if (!fits.length) continue;
    const b = pick(fits, random);
    const [first, second] = a.year < b.year ? [a, b] : [b, a];
    return { id: `${PREFIX.earlier}:${first.id},${second.id}`, subjects: [`e:${a.id}`, `e:${b.id}`] };
  }
  return null;
};

/** Born Here's people: famous, born in a town, and with no town in their name. */
const BORN_POOL = BORN_HERE_PLAYABLE;

const bornIn: Generator = (d, random, used) => {
  const fame = minFame(d);
  const pool = freshPeople(BORN_POOL, used).filter((person) => person.fame >= fame);
  const far = lerp(4000, 350, d);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (!pool.length) return null;
    const answer = pick(pool, random);
    const place = answer.born.place;
    const placeWords = [place.name.en, place.name.pt];
    const others = shuffle(
      BORN_POOL.filter(
        (other) =>
          other.id !== answer.id &&
          other.fame >= Math.min(fame, 80) &&
          fold(other.born.place.name.en) !== fold(place.name.en) &&
          distanceKm(other.born.place, place) >= far * (1 - attempt / TRIES / 2) &&
          !namesTouch([other.name.en, other.name.pt], placeWords),
      ),
      random,
    );
    // Hard ones: born nearer, and in the same centuries.
    const near =
      d > 0.5
        ? [...others].sort(
            (x, y) =>
              distanceKm(x.born.place, place) / 1000 +
              Math.abs(x.born.year - answer.born.year) / 100 -
              (distanceKm(y.born.place, place) / 1000 + Math.abs(y.born.year - answer.born.year) / 100),
          )
        : others;
    const wrong = near.slice(0, 8);
    if (wrong.length < 3) continue;
    const chosen = shuffle(wrong, random).slice(0, 3);
    return { id: `${PREFIX.bornIn}:${[answer, ...chosen].map((p) => p.id).join(",")}`, subjects: [`p:${answer.id}`] };
  }
  return null;
};

const PEOPLE = NOTABLES.filter((person) => person.fame >= 40);

/** Years between two lives: negative when they overlapped (minus the years both were alive). */
export const gapOf = (a: Notable, b: Notable): number =>
  Math.max(a.born.year, b.born.year) - Math.min(a.died.year, b.died.year);

const met: Generator = (d, random, used) => {
  const fame = minFame(d);
  const pool = freshPeople(PEOPLE, used).filter((person) => person.fame >= fame);
  const yes = random() < 0.5;
  const span = yes ? band(d, [25, 80], [2, 8]) : band(d, [80, 1500], [2, 12]);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (!pool.length) return null;
    const a = pick(pool, random);
    const loose = attempt / TRIES;
    const fits = pool.filter((b) => {
      if (b.id === a.id) return false;
      const gap = gapOf(a, b);
      // A year either side is never asked: the dates are too rough for that.
      if (Math.abs(gap) < 2) return false;
      if (yes !== gap < 0) return false;
      return within(Math.abs(gap), [span[0] * (1 - loose), span[1] * (1 + loose * 3)]);
    });
    if (!fits.length) continue;
    const b = pick(fits, random);
    const pair = random() < 0.5 ? [a, b] : [b, a];
    return {
      id: `${PREFIX.met}:${yes ? "yes" : "no"}:${pair.map((p) => p.id).join(",")}`,
      subjects: [`p:${a.id}`, `p:${b.id}`],
    };
  }
  return null;
};

const bornFirst: Generator = (d, random, used) => {
  const fame = minFame(d);
  const pool = freshPeople(PEOPLE, used).filter((person) => person.fame >= fame);
  const gap = band(d, [150, 2500], [3, 20]);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (!pool.length) return null;
    const a = pick(pool, random);
    const loose = attempt / TRIES;
    const fits = pool.filter((b) => {
      const years = Math.abs(a.born.year - b.born.year);
      return b.id !== a.id && years >= 3 && within(years, [gap[0] * (1 - loose), gap[1] * (1 + loose * 3)]);
    });
    if (!fits.length) continue;
    const b = pick(fits, random);
    const [first, second] = a.born.year < b.born.year ? [a, b] : [b, a];
    return { id: `${PREFIX.bornFirst}:${first.id},${second.id}`, subjects: [`p:${a.id}`, `p:${b.id}`] };
  }
  return null;
};

export const valueOf = (country: Country, measure: Measure): number | undefined =>
  measure === "area" ? country.area : factsOf(country.id)?.population;

const bigger: Generator = (d, random, used) => {
  const measure: Measure = random() < 0.5 ? "population" : "area";
  const pool = freshCountries(countryPool(d), used).filter((country) => (valueOf(country, measure) ?? 0) > 0);
  const ratio = band(d, [4, 40], [1.08, 1.4]);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (!pool.length) return null;
    const a = pick(pool, random);
    const loose = attempt / TRIES;
    const x = valueOf(a, measure)!;
    const fits = pool.filter((b) => {
      if (b.id === a.id) return false;
      const y = valueOf(b, measure)!;
      const r = Math.max(x, y) / Math.min(x, y);
      // Near ties are never asked.
      return r >= 1.08 && within(r, [Math.max(1.08, ratio[0] * (1 - loose)), ratio[1] * (1 + loose * 3)]);
    });
    if (!fits.length) continue;
    const b = pick(fits, random);
    const [more, less] = x > valueOf(b, measure)! ? [a, b] : [b, a];
    return { id: `${PREFIX.bigger}:${measure}:${more.id},${less.id}`, subjects: [`c:${a.id}`, `c:${b.id}`] };
  }
  return null;
};

const border: Generator = (d, random, used) => {
  const pool = freshCountries(countryPool(d), used).filter((country) => country.borders.length > 0);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (!pool.length) return null;
    const country = pick(pool, random);
    const neighbours = country.borders.map(countryById).filter((c): c is Country => c !== undefined);
    if (!neighbours.length) continue;
    const answer = pick(neighbours, random);
    const steps = stepsFrom(country.id);
    const notNeighbour = (other: Country) => other.id !== country.id && other.id !== answer.id && !country.borders.includes(other.id);
    // Easy: from other continents. Harder: the same one. Hardest: a neighbour's neighbour.
    const twoAway = COUNTRIES.filter((other) => notNeighbour(other) && steps.get(other.id) === 2);
    const sameSide = COUNTRIES.filter((other) => notNeighbour(other) && sameContinent(other, country) && (steps.get(other.id) ?? 9) > 2);
    const farAway = BY_FAMILIARITY.slice(0, 100).filter((other) => notNeighbour(other) && !sameContinent(other, country));
    const wrong: Country[] = [];
    for (let slot = 0; slot < 3; slot++) {
      const roll = random();
      const source = roll < lerp(-0.2, 0.9, d) ? twoAway : roll < lerp(0.3, 1, d) ? sameSide : farAway;
      const left = [source, sameSide, twoAway, farAway].map((list) => list.filter((c) => !wrong.includes(c))).find((list) => list.length);
      if (!left) break;
      wrong.push(pick(left, random));
    }
    if (wrong.length < 3) continue;
    return {
      id: `${PREFIX.border}:${country.id}:${[answer, ...wrong].map((c) => c.id).join(",")}`,
      subjects: [`c:${country.id}`, `c:${answer.id}`],
    };
  }
  return null;
};

/** The continents nearest each one, nearest first: the hard wrong answers. */
const NEAR_CONTINENTS: Record<Region, Region[]> = {
  africa: ["europe", "asia", "south-america", "oceania", "north-america"],
  asia: ["europe", "oceania", "africa", "north-america", "south-america"],
  europe: ["asia", "africa", "north-america", "south-america", "oceania"],
  "north-america": ["south-america", "europe", "asia", "oceania", "africa"],
  "south-america": ["north-america", "africa", "europe", "oceania", "asia"],
  oceania: ["asia", "south-america", "north-america", "africa", "europe"],
};

const continent: Generator = (d, random, used) => {
  const pool = freshCountries(countryPool(Math.min(1, d + 0.15)), used).filter((country) => continentOf(country));
  if (!pool.length) return null;
  const country = pick(pool, random);
  const region = continentOf(country)!;
  const others = NEAR_CONTINENTS[region];
  const wrong = random() < d ? others.slice(0, 3) : shuffle(others, random).slice(0, 3);
  return { id: `${PREFIX.continent}:${country.id}:${[region, ...wrong].join(",")}`, subjects: [`c:${country.id}`] };
};

const sameYear: Generator = (d, random, used) => {
  const fame = minFame(d);
  const odd = band(d, [12, 40], [2, 6]);
  const fresh = (moment: Moment) => !used.has(subjectOf(moment)) && momentFame(moment) >= Math.min(fame, 100);
  const years = shuffle([...MOMENTS_BY_YEAR.keys()], random);
  for (const year of years.slice(0, TRIES * 2)) {
    const same: Moment[] = [];
    for (const moment of shuffle(MOMENTS_BY_YEAR.get(year)!, random)) {
      if (fresh(moment) && same.every((other) => subjectOf(other) !== subjectOf(moment))) same.push(moment);
      if (same.length === 3) break;
    }
    if (same.length < 3) continue;
    const outs = MOMENTS.filter(
      (moment) =>
        fresh(moment) &&
        within(Math.abs(moment.year - year), [Math.max(2, Math.round(odd[0])), Math.round(odd[1])]) &&
        same.every((other) => subjectOf(other) !== subjectOf(moment)),
    );
    if (!outs.length) continue;
    const out = pick(outs, random);
    return {
      id: `${PREFIX.sameYear}:${[out, ...same].map((moment) => moment.id).join("|")}`,
      subjects: [out, ...same].map(subjectOf),
    };
  }
  return null;
};

const GENERATORS: Record<Kind, Generator> = {
  flag,
  capital,
  earlier,
  bornIn,
  met,
  bornFirst,
  bigger,
  border,
  continent,
  sameYear,
};

/**
 * A question of `kind` at difficulty `d` (0–1), about nothing in `used`
 * (which it adds to). Falls back to an easier spread of the same kind; null
 * only when the kind has run dry.
 */
export function makeQuestion(kind: Kind, d: number, random: () => number, used: Used): Question | null {
  for (const level of [d, 0.5, 0.25]) {
    const made = GENERATORS[kind](level, random, used);
    const question = made && questionOf(made.id);
    if (made && question) {
      for (const subject of made.subjects) used.add(subject);
      return question;
    }
  }
  return null;
}

// ── Words for the results ───────────────────────────────────────────────────

const momentName = (moment: Moment, locale: Locale) =>
  moment.event ? moment.event.name[locale] : (moment.person?.name[locale] ?? moment.id);

/** A choice in words, as the review lists it (without the board's templates). */
export function choiceText(question: Question, id: string, locale: Locale): string {
  switch (question.type) {
    case "flag":
    case "capitalOf":
    case "bigger":
    case "border":
      return question.choices.find((c) => c.id === id)?.name[locale] ?? id;
    case "capital":
      return question.choices.find((c) => c.id === id)?.name[locale] ?? id;
    case "earlier":
      return question.choices.find((c) => c.id === id)?.name[locale] ?? id;
    case "bornIn":
    case "bornFirst":
      return question.choices.find((c) => c.id === id)?.name[locale] ?? id;
    case "met":
      return question.pair.map((person) => person.name[locale]).join(" · ");
    case "continent":
      return REGION_NAMES[id as Region]?.[locale] ?? id;
    case "sameYear": {
      const moment = question.choices.find((c) => c.id === id);
      return moment ? momentName(moment, locale) : id;
    }
  }
}

/** What a question was about, named by its right answer. */
export const answerText = (question: Question, locale: Locale): string => choiceText(question, question.answer, locale);

/** The difficulty's familiarity rank of a country (0 = the best known), for checks. */
export const familiarity = (country: Country): number => RANK.get(country.id) ?? COUNTRIES.length;
