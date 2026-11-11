import { MAX_POINTS } from "@/lib/points";
import { stageCount, type ExpeditionSettings } from "./settings";

// A run is one expedition being played: where the player is, what they have
// done on the puzzle in front of them, and what each finished puzzle earned.
// It is plain data, kept in lib/storage, so a reload picks up where it was.

export type StageResult = {
  points: number;
  /** The short result as the game words it: "3/6", "840". */
  detail: string;
  /** The clock ran out before the puzzle was finished. */
  timedOut?: boolean;
};

export type Run = {
  /** Tells one run from another: a new id means start over. */
  id: string;
  /** Deals the puzzles (see buildStages). */
  seed: string;
  settings: ExpeditionSettings;
  /** Index of the puzzle on screen; equal to the number of puzzles once the run is over. */
  stage: number;
  /** The player's moves on that puzzle, in the game's own shape. */
  moves: unknown[];
  /** When that puzzle came on screen (ms since the epoch): its clock runs from here. */
  startedAt: number;
  /** One per finished puzzle, in order. The puzzle on screen is finished when it has one. */
  results: StageResult[];
};

/** A run at its first puzzle — or further along, when some were already scored elsewhere. */
export function newRun(id: string, seed: string, settings: ExpeditionSettings, results: StageResult[] = []): Run {
  return { id, seed, settings, stage: results.length, moves: [], startedAt: Date.now(), results };
}

export const runTotal = (results: { points: number }[]): number =>
  results.reduce((sum, result) => sum + result.points, 0);

export const runMax = (settings: Pick<ExpeditionSettings, "rounds">): number => stageCount(settings) * MAX_POINTS;

export const isRunOver = (run: Run): boolean => run.stage >= stageCount(run.settings);

/** 0–4: how well a puzzle went, for the coloured squares of a result. */
export function gradeOf(points: number): 0 | 1 | 2 | 3 | 4 {
  if (points >= 900) return 4;
  if (points >= 650) return 3;
  if (points >= 400) return 2;
  if (points > 0) return 1;
  return 0;
}
