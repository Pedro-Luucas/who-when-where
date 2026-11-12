"use client";

import { inChallenge } from "@/games/registry";
import { readDailyResults, settleResults, type DailyResult } from "@/games/results";
import { readStore, writeStore } from "@/lib/storage";
import { putResults } from "./client";

// Sends a signed-in player's finished daily puzzles to the leaderboards.
// The server keeps the first score it gets for a day, so sending one twice
// is harmless; this only remembers what was sent to avoid asking again.

type Sent = {
  /** Whose scores were sent (an account id). */
  owner: string | null;
  /** "game:day" of each score the server has. */
  keys: string[];
};

const SENT_KEY = "account:results-sent";
const NOTHING_SENT: Sent = { owner: null, keys: [] };
const CHUNK = 100;

/** Uploads the finished puzzles on this device that the account does not have yet. */
export async function pushResults(userId: string): Promise<void> {
  const stored = readStore(SENT_KEY, NOTHING_SENT);
  const sent = new Set(stored.owner === userId ? stored.keys : []);
  // Days that have just arrived from the account may not be scored yet.
  await settleResults();
  const pending = readDailyResults().filter((result) => !sent.has(`${result.game}:${result.day}`));

  async function send(results: DailyResult[]) {
    for (let start = 0; start < results.length; start += CHUNK) {
      const chunk = results.slice(start, start + CHUNK);
      await putResults(chunk);
      for (const result of chunk) sent.add(`${result.game}:${result.day}`);
      writeStore<Sent>(SENT_KEY, { owner: userId, keys: [...sent] });
    }
  }

  // The daily challenge's games first: every version of the accounts API keeps their scores.
  await send(pending.filter((result) => inChallenge(result.game)));
  // Then every other game on its own: an accounts API from before a game refuses
  // its scores, and that must not hold back the games it does know.
  const others = new Map<string, DailyResult[]>();
  for (const result of pending) {
    if (inChallenge(result.game)) continue;
    others.set(result.game, [...(others.get(result.game) ?? []), result]);
  }
  for (const results of others.values()) {
    try {
      await send(results);
    } catch {
      // Not marked as sent, so they go up with a later sync, once the API knows the game.
    }
  }
}

/** Forgets what was sent, when the player signs out of this device. */
export function forgetResults(): void {
  writeStore(SENT_KEY, NOTHING_SENT);
}
