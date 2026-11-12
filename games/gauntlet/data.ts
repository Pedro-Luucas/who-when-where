import { defineSetData } from "../engines/kit";
import { pickScore } from "../engines/rules";
import { answerText, type Question } from "../quickplay/questions";
import { answersOf, dealQuestions, kindOrder, questionsOf } from "../quickplay/run";
import { definition } from "./definition";

// Gauntlet without its interface: survival. Forty questions from every game
// (Quickplay's bank), never the same kind twice in a row, from easy to very
// hard: a new level every five. The run ends at the third wrong answer; each
// right one is worth 25 points.

export const ROUNDS = 40;
export const LIVES = 3;
/** Questions per level. */
export const LEVEL_SIZE = 5;
export const LEVELS = Math.ceil(ROUNDS / LEVEL_SIZE);

/** The questions, in the order they are asked. */
export type Puzzle = Question[];

/** 0 for the first question, 1 for the last. */
export const difficultyAt = (i: number) => i / (ROUNDS - 1);

/** The level of the i-th question (from 0): 1 to LEVELS. */
export const levelAt = (i: number) => Math.min(LEVELS, Math.floor(i / LEVEL_SIZE) + 1);

function dealRun(seed: string): Puzzle {
  return dealQuestions(seed, kindOrder(seed, ROUNDS), difficultyAt);
}

export { answersOf };

export default defineSetData<Puzzle, string>(definition.slug, {
  forDay: (day) => dealRun(`${definition.slug}:day:${day}`),
  deal: (seed) => dealRun(`${definition.slug}:${seed}`),
  fromIds: questionsOf,
  idsOf: (questions) => questions.map((question) => question.id),
  score: (questions, moves) => pickScore(answersOf(questions), moves, LIVES),
  answer: (questions, locale) => (questions[0] ? answerText(questions[0], locale) : ""),
});
