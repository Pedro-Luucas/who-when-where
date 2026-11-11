import { seededShuffle } from "@/lib/daily";

/**
 * Deals puzzles for a game whose puzzles are single roster items: `count` of
 * `ids`, in an order that is always the same for the same seed.
 */
export const dealFrom =
  (ids: readonly string[]) =>
  (seed: string, count: number): string[][] =>
    seededShuffle(ids, seed)
      .slice(0, count)
      .map((id) => [id]);
