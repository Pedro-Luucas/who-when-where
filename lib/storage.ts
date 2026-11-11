"use client";

import { useCallback, useSyncExternalStore } from "react";

// localStorage-backed state shared across components (and tabs).
// Values are JSON; a parsed value is cached until its raw string changes, so
// snapshots stay referentially stable for useSyncExternalStore.

const PREFIX = "www:";
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();
const memory = new Map<string, string>(); // fallback when storage is blocked

function readRaw(key: string): string | null {
  // A write that did not fit in localStorage lives in memory: reads must see it too.
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, raw);
    memory.delete(key);
  } catch {
    memory.set(key, raw);
  }
}

/** Says whether a stored value has the shape the code reading it expects. */
export type Check = (value: unknown) => boolean;

export function readStore<T>(key: string, fallback: T, valid?: Check): T {
  const raw = readRaw(key);
  // Nothing stored: each caller gets its own fallback, so it is never cached
  // (two callers may read the same key with different ones).
  if (raw === null) return fallback;
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  try {
    const value = JSON.parse(raw) as T;
    // A save of the wrong shape (an old version, a bad sync) is ignored; the next write replaces it.
    if (valid && !valid(value)) return fallback;
    cache.set(key, { raw, value });
    return value;
  } catch {
    // Corrupt entry: fall back, and let the next write replace it.
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  writeRaw(key, raw);
  cache.set(key, { raw, value });
  listeners.forEach((listener) => listener());
}

export function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Persistent state. `fallback` is used on the server and when nothing is
 * stored; pass a module-level constant so it is referentially stable.
 */
export function usePersistent<T>(
  key: string,
  fallback: T,
  valid?: Check,
): [T, (update: T | ((previous: T) => T)) => void] {
  const value = useSyncExternalStore(
    subscribeToStore,
    () => readStore(key, fallback, valid),
    () => fallback,
  );
  const set = useCallback(
    (update: T | ((previous: T) => T)) => {
      const next =
        typeof update === "function"
          ? (update as (previous: T) => T)(readStore(key, fallback, valid))
          : update;
      writeStore(key, next);
    },
    [key, fallback, valid],
  );
  return [value, set];
}
