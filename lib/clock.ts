"use client";

import { useSyncExternalStore } from "react";
import { dayNumberFor, msUntilTomorrow } from "./daily";

// In development, ?day=N plays another day's puzzle.
function dayOverride(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const value = Number(new URLSearchParams(window.location.search).get("day"));
  return Number.isInteger(value) && value !== 0 ? value : null;
}

function currentDay(): number {
  return dayOverride() ?? dayNumberFor(new Date());
}

function subscribeToDay(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    timer = setTimeout(() => {
      onChange();
      arm();
    }, msUntilTomorrow(new Date()) + 50);
  };
  arm();
  // A tab left open overnight may have slept through the timer.
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** Today's puzzle number; re-renders when the local date rolls over. */
export function useDayNumber(): number {
  return useSyncExternalStore(subscribeToDay, currentDay, () => 0);
}

function subscribeToSeconds(onChange: () => void): () => void {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}

const secondsUntilTomorrow = () => Math.ceil(msUntilTomorrow(new Date()) / 1000);

/** Seconds left until the next puzzle, ticking once a second. */
export function useSecondsUntilTomorrow(): number {
  return useSyncExternalStore(subscribeToSeconds, secondsUntilTomorrow, () => 0);
}
