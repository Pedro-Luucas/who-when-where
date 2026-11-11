"use client";

import { useEffect, useRef } from "react";

// Moving on to the next question removes the button that was just pressed, and
// the keyboard or screen-reader cursor would fall back to the top of the page.
// A question heading takes the focus instead — but only once the player has
// interacted, so loading a page never steals focus.

let interacted = false;
if (typeof window !== "undefined") {
  const note = () => {
    interacted = true;
    window.removeEventListener("pointerdown", note, true);
    window.removeEventListener("keydown", note, true);
  };
  window.addEventListener("pointerdown", note, true);
  window.addEventListener("keydown", note, true);
}

/** Put on a heading (with tabIndex={-1}): it takes focus when it appears and nothing else has it. */
export function useFocusWhenLost<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (interacted && (!active || active === document.body)) ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
