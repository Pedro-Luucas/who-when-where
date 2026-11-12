"use client";

import { useSyncExternalStore } from "react";
import { dayEndsAt, dayNumberFor, msUntilTomorrow } from "./daily";

// The site's clock: which UTC day it is, and how long until the next one.
//
// The day is the server's, not the device's: a phone set a day ahead must not
// open tomorrow's puzzles. On the first look the browser asks the accounts API
// for the time (the Date header of its health check, which every version of the
// API sends) and keeps the difference to its own clock. Until that answer
// comes — or if the API cannot be reached — the device's clock is used.

let offset = 0;
let synced = false;
const listeners = new Set<() => void>();

function syncWithServer(): void {
  if (synced) return;
  synced = true;
  const sent = Date.now();
  fetch("/api/health", { cache: "no-store", credentials: "omit" })
    .then((response) => {
      const date = Date.parse(response.headers.get("date") ?? "");
      if (!response.ok || Number.isNaN(date)) return;
      // The header is to the second: half the round trip is as good as it gets.
      const received = Date.now();
      const difference = date + 500 - (sent + received) / 2;
      // A few seconds either way is the header's own rounding: only a real gap counts.
      if (Math.abs(difference) < 5_000) return;
      offset = difference;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Offline, or no API: the device's clock it is.
    });
}

/** Now, by the server's clock as far as it is known. */
export function serverNow(): Date {
  return new Date(Date.now() + offset);
}

// In development, ?today=N makes day N today (to try tomorrow's puzzles).
function todayOverride(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const value = Number(new URLSearchParams(window.location.search).get("today"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function currentDay(): number {
  return todayOverride() ?? dayNumberFor(serverNow());
}

function subscribeToDay(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    timer = setTimeout(() => {
      onChange();
      arm();
    }, msUntilTomorrow(serverNow()) + 50);
  };
  const resync = () => {
    clearTimeout(timer);
    onChange();
    arm();
  };
  arm();
  listeners.add(resync);
  syncWithServer();
  // A tab left open overnight may have slept through the timer.
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearTimeout(timer);
    listeners.delete(resync);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** Today's puzzle number (a UTC day); re-renders when the day rolls over. 0 on the server. */
export function useDayNumber(): number {
  return useSyncExternalStore(subscribeToDay, currentDay, () => 0);
}

function subscribeToSeconds(onChange: () => void): () => void {
  const timer = setInterval(onChange, 1000);
  listeners.add(onChange);
  syncWithServer();
  return () => {
    clearInterval(timer);
    listeners.delete(onChange);
  };
}

const secondsUntilTomorrow = () => Math.ceil(msUntilTomorrow(serverNow()) / 1000);

/** Seconds left until the next puzzles (00:00 UTC), ticking once a second. */
export function useSecondsUntilTomorrow(): number {
  return useSyncExternalStore(subscribeToSeconds, secondsUntilTomorrow, () => 0);
}

/** When the next puzzles arrive, as a moment (shown in the player's own time). */
export function nextDayAt(): Date {
  return dayEndsAt(dayNumberFor(serverNow()));
}

const nextDayStamp = () => nextDayAt().getTime();

/** When the next puzzles arrive, in ms since 1970 (0 on the server); follows the day. */
export function useNextDayAt(): number {
  return useSyncExternalStore(subscribeToDay, nextDayStamp, () => 0);
}
