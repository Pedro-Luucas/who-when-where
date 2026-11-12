import { seededRandom, seededShuffle } from "@/lib/daily";
import { KINDS, makeQuestion, questionOf, type Kind, type Question, type Used } from "./questions";

// A run of questions, as Quickplay and Gauntlet deal them: the kinds in a
// seeded order, each question at the difficulty of its place in the run.

/**
 * `count` kinds: the ten in a shuffled order, then shuffled again, and so on,
 * never the same kind twice in a row.
 */
export function kindOrder(seed: string, count: number): Kind[] {
  const kinds: Kind[] = [];
  for (let bag = 0; kinds.length < count; bag++) {
    let order = seededShuffle(KINDS, `${seed}:kinds:${bag}`);
    if (order[0] === kinds.at(-1)) order = [...order.slice(1), order[0]];
    kinds.push(...order);
  }
  return kinds.slice(0, count);
}

/** A question for each kind, at `difficulty(i)` for the i-th; a kind that has run dry gives way to another. */
export function dealQuestions(seed: string, kinds: readonly Kind[], difficulty: (i: number) => number): Question[] {
  const random = seededRandom(seed);
  const used: Used = new Set();
  const questions: Question[] = [];
  for (const [i, kind] of kinds.entries()) {
    const d = difficulty(i);
    const previous = questions.at(-1)?.kind;
    const next = kinds[i + 1];
    const question =
      makeQuestion(kind, d, random, used) ??
      KINDS.filter((other) => other !== kind && other !== previous && other !== next).reduce<Question | null>(
        (found, other) => found ?? makeQuestion(other, d, random, used),
        null,
      );
    if (question) questions.push(question);
  }
  return questions;
}

/** The questions the ids name, unless one of them is no longer in the rosters. */
export function questionsOf(ids: readonly string[]): Question[] | undefined {
  const questions = ids.map(questionOf);
  if (!questions.length || questions.some((question) => question === undefined)) return undefined;
  return questions as Question[];
}

export const answersOf = (questions: readonly Question[]): string[] => questions.map((question) => question.answer);
