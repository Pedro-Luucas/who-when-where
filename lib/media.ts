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

// ── The phone UI ──
// Phones get screens of their own where the desktop layout does not translate:
// the bottom tab bar and the "Me" sheet, full-screen games with a one-row HUD
// and a menu sheet, bottom sheets for every dialog. Where only the styling
// differs, app/mobile.css does it with the same breakpoints; where the
// structure differs, components ask useIsMobile().

/** Below the md breakpoint (48rem): phones, and small tablets held upright. Same as app/mobile.css. */
export const PHONE = "(max-width: 47.99rem)";

/** A phone on its side: wide but very short. Map games put the map beside the prompt. */
export const PHONE_LANDSCAPE = "(orientation: landscape) and (max-height: 31.25rem) and (max-width: 63.99rem)";

/** Either of the two: every screen the phone UI is for. */
export const HANDHELD = `${PHONE}, ${PHONE_LANDSCAPE}`;

/**
 * True on the screens the phone UI is for (a phone either way up, a small
 * tablet upright). False on the server and while hydrating, so the desktop
 * structure is what streams; components that differ swap after mount.
 */
export function useIsMobile(): boolean {
  return useMedia(HANDHELD);
}

/** True on a phone held on its side. */
export function useIsPhoneLandscape(): boolean {
  return useMedia(PHONE_LANDSCAPE);
}
