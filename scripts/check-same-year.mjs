// Same Year has events only: never "X is born" or "X dies" ("Nasce…", "Morre…").
// Fails if a birth or a death comes back into its moments — or into Quickplay's
// same-year question, which deals from the same list — or if a day no longer
// has its ten rounds. `npm run check:same-year` (also part of `npm run lint`).
import path from "node:path";
import { createJiti } from "jiti";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": ROOT }, interopDefault: true });
const load = (file) => jiti(path.join(ROOT, file));

const { MOMENTS, BIRTH_OR_DEATH } = load("games/same-year/moments.ts");
const sameYear = load("games/same-year/data.ts").default;
const { ROUNDS } = load("games/same-year/data.ts");
const { makeQuestion } = load("games/quickplay/questions.ts");
const { seededRandom, dayNumberFor } = load("lib/daily.ts");

const problems = [];
const notAnEvent = (moment) =>
  /^[bd]:/.test(moment.id) || "person" in moment || "what" in moment || BIRTH_OR_DEATH.test(moment.name.en) || BIRTH_OR_DEATH.test(moment.name.pt);

for (const moment of MOMENTS) if (notAnEvent(moment)) problems.push(`moment ${moment.id}: "${moment.name.en}" / "${moment.name.pt}" is a birth or a death`);
if (new Set(MOMENTS.map((moment) => moment.id)).size !== MOMENTS.length) problems.push("two moments share an id");

const DAYS = 1200;
// Every day of the archive since the start of 2025, and a couple of years ahead.
const FIRST = dayNumberFor(new Date(2025, 0, 1));
for (let day = FIRST; day < FIRST + DAYS; day++) {
  const puzzle = sameYear.puzzleForDay(day);
  if (!puzzle || puzzle.length !== ROUNDS) problems.push(`day ${day}: ${puzzle?.length ?? 0} rounds, not ${ROUNDS}`);
  const ids = (puzzle ?? []).flatMap((round) => round.options.map((moment) => moment.id));
  if (new Set(ids).size !== ids.length) problems.push(`day ${day}: a moment comes up twice`);
  for (const round of puzzle ?? []) {
    if (round.options.length !== 4) problems.push(`day ${day}: a round has ${round.options.length} moments`);
    for (const moment of round.options) if (notAnEvent(moment)) problems.push(`day ${day}: ${moment.id} is a birth or a death`);
  }
}
// Practice games: dealt as ids, read back the way a saved game is.
for (const ids of sameYear.deal("check", 200)) {
  const puzzle = sameYear.puzzleOf(ids);
  if (!puzzle || puzzle.length !== ROUNDS) problems.push(`practice ${ids[0]}: ${puzzle?.length ?? 0} rounds, not ${ROUNDS}`);
}
// An old save naming a birth or a death reads as no puzzle, so the board deals a fresh one.
if (sameYear.puzzleOf(["b:x|e:bastille|e:x|e:y"]) !== undefined) problems.push("an old birth id still reads as a round");

let asked = 0;
for (let i = 0; i < 400; i++) {
  const question = makeQuestion("sameYear", (i % 10) / 9, seededRandom(`check:${i}`), new Set());
  if (!question) continue;
  asked++;
  for (const moment of question.choices) if (notAnEvent(moment)) problems.push(`quickplay ${question.id}: ${moment.id} is a birth or a death`);
}
if (asked < 350) problems.push(`quickplay made only ${asked} of 400 same-year questions`);

for (const problem of problems) console.log(`✗ ${problem}`);
console.log(`\nSame Year: ${MOMENTS.length} events, ${DAYS} days dealt, ${asked} quickplay questions — ${problems.length ? `${problems.length} problems.` : "events only."}`);
process.exit(problems.length ? 1 : 0);
