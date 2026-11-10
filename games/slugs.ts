// The games' slugs and names as plain data, for code that must not pull in
// the games themselves (see registry.ts for what the hub shows).

export const GAME_SLUGS = ["who-when-where", "wayfarer", "dig-site", "first-to-last"] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];

export const GAME_TITLES: Record<GameSlug, string> = {
  "who-when-where": "Who When Where",
  wayfarer: "Wayfarer",
  "dig-site": "Dig Site",
  "first-to-last": "First to Last",
};

export const isGameSlug = (value: unknown): value is GameSlug => GAME_SLUGS.includes(value as GameSlug);
