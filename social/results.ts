"use client";

import { readDailyResults, settleResults } from "@/games/results";
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

  for (let start = 0; start < pending.length; start += CHUNK) {
    const chunk = pending.slice(start, start + CHUNK);
    await putResults(chunk);
    for (const result of chunk) sent.add(`${result.game}:${result.day}`);
    writeStore<Sent>(SENT_KEY, { owner: userId, keys: [...sent] });
  }
}

/** Forgets what was sent, when the player signs out of this device. */
export function forgetResults(): void {
  writeStore(SENT_KEY, NOTHING_SENT);
}
