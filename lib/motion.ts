// Animations that run in JavaScript (map fly-tos, the year dial's coasting) do
// not see the CSS `prefers-reduced-motion` rule, so they ask here. Browser only.

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** An animation's length: zero (jump straight to the end) for players who asked for less motion. */
export const motionMs = (ms: number): number => (prefersReducedMotion() ? 0 : ms);
