// The games' slugs and names as plain data, for code that must not pull in
// the games themselves (see registry.ts for what the hub shows).

// New games go at the end: challenge links list their puzzles in this order.
export const GAME_SLUGS = ["who-when-where", "wayfarer", "dig-site", "first-to-last", "overland", "outline"] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];

export const GAME_TITLES: Record<GameSlug, string> = {
  "who-when-where": "Who When Where",
  wayfarer: "Wayfarer",
  "dig-site": "Dig Site",
  "first-to-last": "First to Last",
  overland: "Overland",
  outline: "Outline",
};

export const isGameSlug = (value: unknown): value is GameSlug => GAME_SLUGS.includes(value as GameSlug);
