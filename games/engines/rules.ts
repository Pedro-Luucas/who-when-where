import { MAX_POINTS, triesPoints, type Score } from "@/lib/points";

// The scoring of the four engines new games are built on (AUDIT_AND_PLAN §5):
//
//   pick  — rounds of "choose one" (multiple choice, higher or lower, yes or no),
//           optionally with lives: the run ends at the last round or the last life.
//   order — put a handful of things in order; right positions lock; a few attempts.
//   name  — type the answer; every miss shows more; a few guesses (a ladder).
//   pin   — rounds on the map, each scored by how close the pin landed.
//
// Pure functions of a puzzle's answers and the player's moves, so a game's
// data module can score a saved day without its interface. Every engine
// scores on the scale all games share: up to 1,000 points a puzzle.

/** A move given up rather than made: it fills a round or a try and is never right. */
export const PASS = "-";

// ── Pick ────────────────────────────────────────────────────────────────────

export type PickTally = {
  /** Rounds answered (passes included), up to the round the run ended on. */
  played: number;
  correct: number;
  misses: number;
  /** The run is over: every round answered, or every life lost. */
  over: boolean;
  /** Whether each round answered was right. */
  rounds: boolean[];
  /** The longest run of right answers. */
  bestRun: number;
};

/**
 * How a run of picks stands. `answers` holds each round's right option; with
 * `lives`, the run ends at that many misses. Moves past the end are ignored
 * (giving up pads every round that is left).
 */
export function tallyPicks(answers: readonly string[], moves: readonly string[], lives?: number): PickTally {
  const rounds: boolean[] = [];
  let correct = 0;
  let misses = 0;
  let run = 0;
  let bestRun = 0;
  for (let i = 0; i < moves.length && i < answers.length; i++) {
    if (lives !== undefined && misses >= lives) break;
    const right = moves[i] === answers[i];
    rounds.push(right);
    if (right) {
      correct++;
      run++;
      bestRun = Math.max(bestRun, run);
    } else {
      misses++;
      run = 0;
    }
  }
  const over = rounds.length >= answers.length || (lives !== undefined && misses >= lives);
  return { played: rounds.length, correct, misses, over, rounds, bestRun };
}

/** "✓7/10": right answers out of the rounds dealt. Never read as tries ("3/6"). */
export const pickDetail = (correct: number, total: number) => `✓${correct}/${total}`;

/** Points in proportion to the right answers: 1,000 for all of them. */
export function pickScore(answers: readonly string[], moves: readonly string[], lives?: number): Score {
  const tally = tallyPicks(answers, moves, lives);
  return {
    over: tally.over,
    points: answers.length ? Math.round((MAX_POINTS * tally.correct) / answers.length) : 0,
    detail: pickDetail(tally.correct, answers.length),
  };
}

// ── Order ───────────────────────────────────────────────────────────────────

/** One submitted order: item ids, first first. */
export type OrderAttempt = string[];

/** How many items of an attempt sit in the right position. */
export const inPlace = (attempt: readonly string[], truth: readonly string[]): number =>
  attempt.filter((id, i) => id === truth[i]).length;

export function orderSolved(attempts: readonly OrderAttempt[], truth: readonly string[]): boolean {
  const last = attempts.at(-1);
  return !!last && inPlace(last, truth) === truth.length;
}

export const orderOver = (attempts: readonly OrderAttempt[], truth: readonly string[], max: number): boolean =>
  orderSolved(attempts, truth) || attempts.length >= max;

/** An order never found still earns this much per item left in its place. */
const IN_PLACE_POINTS = 25;

export function orderScore(truth: readonly string[], attempts: readonly OrderAttempt[], max: number): Score {
  const solved = orderSolved(attempts, truth);
  const last = attempts.at(-1);
  return {
    over: orderOver(attempts, truth, max),
    points: solved ? triesPoints(attempts.length, max) : last ? IN_PLACE_POINTS * inPlace(last, truth) : 0,
    detail: `${solved ? attempts.length : "X"}/${max}`,
  };
}

// ── Name (a ladder of guesses) ──────────────────────────────────────────────

export const ladderSolved = (answer: string, guesses: readonly string[]): boolean => guesses.at(-1) === answer;

export const ladderOver = (answer: string, guesses: readonly string[], max: number): boolean =>
  ladderSolved(answer, guesses) || guesses.length >= max;

/**
 * Solving on guess n earns triesPoints(n, max); a puzzle that got away earns
 * `consolation` (a game may pay for getting close).
 */
export function ladderScore(answer: string, guesses: readonly string[], max: number, consolation = 0): Score {
  const solved = ladderSolved(answer, guesses);
  return {
    over: ladderOver(answer, guesses, max),
    points: solved ? triesPoints(guesses.length, max) : consolation,
    detail: `${solved ? guesses.length : "X"}/${max}`,
  };
}

// ── Pin ─────────────────────────────────────────────────────────────────────

/** A pin as it is saved: latitude and longitude to two decimals (about a kilometre). */
export type PinMove = [lat: number, lon: number];

export const toPinMove = ({ lat, lon }: { lat: number; lon: number }): PinMove => [
  Math.round(lat * 100) / 100,
  Math.round(lon * 100) / 100,
];

export const isPinMove = (move: unknown): move is PinMove =>
  Array.isArray(move) && move.length === 2 && move.every((n) => typeof n === "number" && Number.isFinite(n));

/**
 * What a pin `km` from the answer earns, from 0 to 1: full marks within
 * `exact` km, then an exponential fall with `scale` (the distance that keeps
 * about a third).
 */
export function closeness(km: number, exact: number, scale: number): number {
  if (km <= exact) return 1;
  return Math.exp(-(km - exact) / scale);
}

/** Rounds worth 0–1 each, added up on the 1,000-point scale. */
export function roundsScore(shares: readonly number[], rounds: number, over: boolean): Score {
  const total = shares.reduce((sum, share) => sum + share, 0);
  const points = rounds ? Math.round((MAX_POINTS * total) / rounds) : 0;
  return { over, points, detail: String(points) };
}

// ── Rounds with tries (the Pin engine's map rounds) ─────────────────────────

/** How one try went: whether it ends the round as found, and what it is worth (0–1). */
export type Judged = { hit: boolean; share: number };

export type RoundWalk<Move> = {
  tries: { move: Move; judged: Judged }[];
  /** Found, out of tries, or given up. */
  done: boolean;
  /** What the round earned: its best try. */
  share: number;
};

/**
 * Walks a flat list of moves through rounds of up to `tries` tries each: a
 * round ends when a try finds it, when its tries run out, or on a PASS.
 * `judge` says how a try went; it must be pure, so data modules can use it.
 */
export function walkRounds<Move>(
  count: number,
  moves: readonly Move[],
  tries: number,
  judge: (round: number, move: Move, attempt: number) => Judged,
): { rounds: RoundWalk<Move>[]; done: number; over: boolean; shares: number[] } {
  const rounds: RoundWalk<Move>[] = [];
  let current: RoundWalk<Move> = { tries: [], done: false, share: 0 };
  for (const move of moves) {
    if (rounds.length >= count) break;
    if ((move as unknown) !== PASS) {
      const judged = judge(rounds.length, move, current.tries.length);
      current.tries.push({ move, judged });
      current.share = Math.max(current.share, judged.share);
    }
    if ((move as unknown) === PASS || current.tries.at(-1)?.judged.hit || current.tries.length >= tries) {
      current.done = true;
      rounds.push(current);
      current = { tries: [], done: false, share: 0 };
    }
  }
  const over = rounds.length >= count;
  return {
    rounds: over ? rounds : [...rounds, current],
    done: rounds.length,
    over,
    shares: rounds.map((round) => round.share),
  };
}
