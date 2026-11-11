import type { Localized } from "@/lib/i18n";
import type { GameSlug } from "./slugs";

// Game families: how the catalogue is grouped and coloured. Each family has a
// colour token (--color-family-<id> in app/tokens.css) used on tiles, chips
// and the stripe above a game's prompt. Plain data, safe to import anywhere.

export const FAMILY_IDS = ["who", "when", "where", "shapes", "flags", "words", "numbers"] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

export const FAMILIES: Record<FamilyId, { name: Localized }> = {
  who: { name: { en: "People", pt: "Pessoas" } },
  when: { name: { en: "Time", pt: "Tempo" } },
  where: { name: { en: "Places", pt: "Lugares" } },
  shapes: { name: { en: "Borders & shapes", pt: "Fronteiras e formas" } },
  flags: { name: { en: "Flags", pt: "Bandeiras" } },
  words: { name: { en: "Words & trivia", pt: "Palavras e curiosidades" } },
  numbers: { name: { en: "Numbers & facts", pt: "Números e fatos" } },
};

/** Which family each of today's games belongs to. */
export const GAME_FAMILIES: Record<GameSlug, FamilyId> = {
  "who-when-where": "who",
  wayfarer: "where",
  "dig-site": "where",
  "first-to-last": "when",
  overland: "shapes",
  outline: "shapes",
};
