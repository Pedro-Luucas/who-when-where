import { seededShuffle } from "@/lib/daily";
import { defineSetData } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { definition } from "./definition";
import { KINDS, answerText, type Question } from "./questions";
import { answersOf, dealQuestions, questionsOf } from "./run";

// Quickplay without its interface: ten questions, one of each kind (a flag,
// a capital, two moments in history, a birthplace…), each in the manner of
// another game. Medium difficulty, rising a little as the run goes on. No
// lives: every question is played, and each right answer is worth 100 points.

export const ROUNDS = KINDS.length;

/** The questions, in the order they are asked. */
export type Puzzle = Question[];

/** From a little under the middle to a little over it. */
export const difficultyAt = (i: number) => 0.3 + (0.35 * i) / (ROUNDS - 1);

function dealRun(seed: string): Puzzle {
  return dealQuestions(seed, seededShuffle(KINDS, `${seed}:kinds`), difficultyAt);
}

export { answersOf };

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealRun(`${definition.slug}:day:${day}`),
  deal: (seed) => dealRun(`${definition.slug}:${seed}`),
  fromIds: questionsOf,
  idsOf: (questions) => questions.map((question) => question.id),
  score: (questions, moves) => pickScore(answersOf(questions), moves),
  answer: (questions, locale) => (questions[0] ? answerText(questions[0], locale) : ""),
});
