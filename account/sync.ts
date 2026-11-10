"use client";

import { SYNCED_SAVES } from "@/games/saves";
import { readStore, writeStore } from "@/lib/storage";
import { api } from "./api";

// Keeps a signed-in player's games the same on every device.
//
// Each started puzzle is one row on the server: (game, day) → record. A
// record's progress (how many moves it holds) only grows, so when two copies
// differ the one that is further along wins; on a tie, the server's.
//
// pull() fetches what changed on the server and merges it into this device;
// push() uploads the days where this device is ahead.

type Save = { days: Record<string, unknown>; seenHelp: boolean };
type RemoteSave = { game: string; day: number; progress: number; record: unknown };

/** What this device knows about the server's copy. */
type SyncState = {
  /** Where the next pull continues from. */
  cursor: number;
  /** Progress the server holds, by game and day. */
  known: Record<string, Record<string, number>>;
};

const OWNER_KEY = "account:owner"; // whose games are on this device (an account id), if anyone's
const SYNC_KEY = "account:sync";
const EMPTY_SAVE: Save = { days: {}, seenHelp: false };
const EMPTY_SYNC: SyncState = { cursor: 0, known: {} };
const CHUNK = 100;

function progressOf(record: unknown, field: string): number {
  const moves = (record as Record<string, unknown> | null)?.[field];
  return Array.isArray(moves) ? moves.length : 0;
}

const isRecord = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value);

function readSave(key: string): Save {
  const save = readStore<Save>(key, EMPTY_SAVE);
  return isRecord(save?.days) ? save : EMPTY_SAVE;
}

/** Removes every game from this device (they stay in the account). */
export function forgetGames(): void {
  for (const { key } of SYNCED_SAVES) writeStore(key, EMPTY_SAVE);
  writeStore<string | null>(OWNER_KEY, null);
  writeStore(SYNC_KEY, EMPTY_SYNC);
}

async function pull(userId: string): Promise<void> {
  const owner = readStore<string | null>(OWNER_KEY, null);
  if (owner !== userId) {
    // Games played here as a guest join the account; another account's do not.
    if (owner !== null) forgetGames();
    writeStore(OWNER_KEY, userId);
    writeStore(SYNC_KEY, EMPTY_SYNC);
  }

  const { cursor } = readStore(SYNC_KEY, EMPTY_SYNC);
  const remote = await api<{ cursor: number; saves: RemoteSave[] }>("GET", `/saves?since=${cursor}`);

  // Read again: a push may have finished while we waited.
  const known = structuredClone(readStore(SYNC_KEY, EMPTY_SYNC).known);
  for (const { game, key, progressField } of SYNCED_SAVES) {
    const incoming = remote.saves.filter((save) => save.game === game && isRecord(save.record));
    if (!incoming.length) continue;

    const local = readSave(key);
    const days = { ...local.days };
    let changed = false;
    for (const { day, progress, record } of incoming) {
      known[game] = { ...known[game], [day]: Math.max(progress, known[game]?.[day] ?? 0) };
      const mine = days[day];
      const ahead = mine !== undefined && progressOf(mine, progressField) > progress;
      if (!ahead && JSON.stringify(mine) !== JSON.stringify(record)) {
        days[day] = record;
        changed = true;
      }
    }
    // Someone with games in their account has seen how to play.
    if (changed || !local.seenHelp) writeStore<Save>(key, { ...local, days, seenHelp: true });
  }
  writeStore<SyncState>(SYNC_KEY, { cursor: remote.cursor, known });
}

async function push(): Promise<void> {
  const { known } = readStore(SYNC_KEY, EMPTY_SYNC);
  const pending: RemoteSave[] = [];
  for (const { game, key, progressField } of SYNCED_SAVES) {
    for (const [day, record] of Object.entries(readSave(key).days)) {
      const number = Number(day);
      if (!Number.isInteger(number) || number < 1 || !isRecord(record)) continue;
      const progress = progressOf(record, progressField);
      if (progress > (known[game]?.[day] ?? -1)) pending.push({ game, day: number, progress, record });
    }
  }

  for (let start = 0; start < pending.length; start += CHUNK) {
    const chunk = pending.slice(start, start + CHUNK);
    await api("PUT", "/saves", { saves: chunk });
    const state = readStore(SYNC_KEY, EMPTY_SYNC);
    const next = structuredClone(state.known);
    for (const { game, day, progress } of chunk) {
      next[game] = { ...next[game], [day]: Math.max(progress, next[game]?.[day] ?? 0) };
    }
    writeStore<SyncState>(SYNC_KEY, { ...state, known: next });
  }
}

// One sync at a time, in the order they were asked for.
let queue: Promise<void> = Promise.resolve();

function enqueue(work: () => Promise<void>): Promise<void> {
  const run = queue.then(work);
  queue = run.catch(() => {});
  return run;
}

/** Brings this device and the account's games in line with each other. */
export function syncGames(userId: string): Promise<void> {
  return enqueue(async () => {
    await pull(userId);
    await push();
  });
}

/** Uploads what was played here since the last sync. */
export function pushGames(): Promise<void> {
  return enqueue(push);
}
