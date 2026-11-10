"use client";

import { useSyncExternalStore } from "react";

// Short notices that slide in over the page and leave on their own. They
// live outside React so anything can raise one; <Toasts /> in the root
// layout shows them.

export type Toast = {
  id: number;
  /** A few characters stamped beside the text: "7d", "1000". */
  mark: string;
  title: string;
  body: string;
  /** Where a tap on the notice leads. */
  href?: string;
};

/** How long a notice stays, in milliseconds. */
export const TOAST_MS = 6500;
const MOST = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const NONE: Toast[] = [];

function set(next: Toast[]): void {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function toast(notice: Omit<Toast, "id">): void {
  set([...toasts, { ...notice, id: nextId++ }].slice(-MOST));
}

export function dismissToast(id: number): void {
  set(toasts.filter((entry) => entry.id !== id));
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts,
    () => NONE,
  );
}
