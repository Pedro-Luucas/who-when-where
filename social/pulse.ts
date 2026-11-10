"use client";

import { useSyncExternalStore } from "react";
import { useAccount } from "@/account/state";
import { getPulse, type Pulse } from "./client";

// What is waiting for the signed-in player: friend requests, unread direct
// messages and party invitations. One copy for the whole page, refreshed
// every little while as long as something on screen shows it.

const EVERY_MS = 20_000;
const NOTHING: Pulse = { requests: 0, unread: [], invites: [] };

let pulse: Pulse = NOTHING;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/** Asks the server again now; call it after doing something that changes the answer. */
export async function refreshPulse(): Promise<void> {
  if (document.visibilityState === "hidden") return;
  try {
    pulse = await getPulse();
  } catch {
    return; // signed out, or offline: keep what we had
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshPulse();
    timer = setInterval(refreshPulse, EVERY_MS);
    document.addEventListener("visibilitychange", refreshPulse);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshPulse);
      pulse = NOTHING; // the next player on this device starts clean
    }
  };
}

const idle = () => () => {};

/** What is waiting for the player; nothing for visitors. */
export function usePulse(): Pulse {
  const signedIn = useAccount().status === "user";
  const current = useSyncExternalStore(
    signedIn ? subscribe : idle,
    () => pulse,
    () => NOTHING,
  );
  return signedIn ? current : NOTHING;
}

/** How many things are waiting, for a badge. */
export const pulseCount = (value: Pulse): number =>
  value.requests + value.invites.length + value.unread.reduce((sum, entry) => sum + entry.count, 0);
