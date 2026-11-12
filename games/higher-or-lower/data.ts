import { seededRandom } from "@/lib/daily";
import { COUNTRIES, countryById, type Country } from "@/lib/countries";
import { factsOf } from "@/lib/geo-data";
import { defineSetData, pickOne } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { definition } from "./definition";

// Higher or Lower without its interface: pairs of countries and a measure —
// people, land, income, lifespan, towns, forest. Which is higher? The run
// ends at the third miss. Near ties are never asked.

export const ROUNDS = 20;
export const LIVES = 3;

export const MEASURES = ["population", "area", "gdpPerCapita", "lifeExpectancy", "urban", "forest"] as const;
export type Measure = (typeof MEASURES)[number];

export type Round = { measure: Measure; a: Country; b: Country };
export type Puzzle = Round[];

export function valueOf(country: Country, measure: Measure): number | undefined {
  if (measure === "area") return country.area;
  return factsOf(country.id)?.[measure];
}

/** Two values are a fair question only this far apart — and close enough not to be obvious. */
function apart(measure: Measure, x: number, y: number): boolean {
  const gap = Math.abs(x - y);
  if (measure === "lifeExpectancy") return gap >= 2 && gap <= 15;
  if (measure === "urban" || measure === "forest") return gap >= 5 && gap <= 40;
  const ratio = Math.max(x, y) / Math.max(Math.min(x, y), 1);
  return ratio >= 1.15 && ratio <= 6;
}

export const answerOf = (round: Round): string =>
  (valueOf(round.a, round.measure) ?? 0) >= (valueOf(round.b, round.measure) ?? 0) ? round.a.id : round.b.id;

export const answersOf = (puzzle: Puzzle) => puzzle.map(answerOf);

const isMeasure = (value: string): value is Measure => (MEASURES as readonly string[]).includes(value);

function dealRounds(seed: string, variant?: string): Puzzle {
  const random = seededRandom(seed);
  const measures: readonly Measure[] = variant && isMeasure(variant) ? [variant] : MEASURES;
  const rounds: Round[] = [];
  const recent: string[] = [];
  for (let attempt = 0; rounds.length < ROUNDS && attempt < ROUNDS * 30; attempt++) {
    const measure = measures.length === 1 ? measures[0] : measures[rounds.length % measures.length];
    const known = COUNTRIES.filter((country) => valueOf(country, measure) !== undefined && !recent.includes(country.id));
    const a = pickOne(known, random);
    const b = pickOne(known, random);
    if (a.id === b.id || !apart(measure, valueOf(a, measure)!, valueOf(b, measure)!)) continue;
    rounds.push({ measure, a, b });
    // A country comes back no sooner than a few rounds later.
    recent.push(a.id, b.id);
    if (recent.length > 12) recent.splice(0, 2);
  }
  // Mixed runs shuffle the measures, so the order isn't a pattern.
  if (measures.length > 1) {
    for (let i = rounds.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
    }
  }
  return rounds;
}

function fromIds(ids: string[]): Puzzle | undefined {
  const rounds: Round[] = [];
  for (const id of ids) {
    const [measure, x, y] = id.split(":");
    const a = countryById(x);
    const b = countryById(y);
    if (!isMeasure(measure) || !a || !b || valueOf(a, measure) === undefined || valueOf(b, measure) === undefined) return undefined;
    rounds.push({ measure, a, b });
  }
  return rounds.length ? rounds : undefined;
}

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealRounds(`${definition.slug}:day:${day}`),
  deal: (seed, variant) => dealRounds(`${definition.slug}:${seed}`, variant),
  fromIds,
  idsOf: (puzzle) => puzzle.map((round) => `${round.measure}:${round.a.id}:${round.b.id}`),
  score: (puzzle, moves) => pickScore(answersOf(puzzle), moves, LIVES),
  answer: (puzzle, locale) => (puzzle[0] ? `${puzzle[0].a.name[locale]} · ${puzzle[0].b.name[locale]}` : ""),
});
