"use client";

import { useSyncExternalStore } from "react";

/** Whether a media query matches, following changes. False on the server and while hydrating. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The lg breakpoint (64rem), where side panels sit beside the content. */
export const WIDE = "(min-width: 64rem)";
