import type { Score } from "@/lib/points";

// The scoring of the games that have been loaded so far. A game's data module
// adds itself here as it loads (defineData), which lets games/results.ts score
// a move the moment it is saved — and tells it which games it still has to fetch.

/** A saved day's score, or null while it is unfinished. */
export type Scorer = (record: unknown) => Score | null;

const scorers = new Map<string, Scorer>();

export function registerScorer(slug: string, scorer: Scorer): void {
  scorers.set(slug, scorer);
}

export const scorerOf = (slug: string): Scorer | undefined => scorers.get(slug);
