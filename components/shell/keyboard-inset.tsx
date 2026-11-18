"use client";

import { useEffect } from "react";

// How much of the screen a collapsing browser bar can hide before we treat
// the rest as a keyboard. A real keyboard is far taller than that.
const BAR = 80;

/**
 * Sets `--keyboard` to the strip a soft keyboard covers. Chrome resizes the
 * page (see `interactiveWidget` on the viewport). iOS overlays it, and a
 * fixed guess field would sit underneath; the phone CSS lifts those bars by
 * this amount. A short change is the address bar, and is ignored.
 */
export function KeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;

    const apply = () => {
      const covered = window.innerHeight - viewport.offsetTop - viewport.height;
      const inset = covered < BAR ? 0 : Math.round(covered);
      root.style.setProperty("--keyboard", `${inset}px`);
    };

    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      root.style.removeProperty("--keyboard");
    };
  }, []);

  return null;
}
