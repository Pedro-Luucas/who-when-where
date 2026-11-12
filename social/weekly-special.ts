import type { Run } from "@/expedition/run";
import { DEFAULT_SETTINGS, normalizeSettings, type ExpeditionSettings } from "@/expedition/settings";
import type { FamilyId } from "@/games/families";
import type { GameSlug } from "@/games/registry";
import type { Localized } from "@/lib/i18n";
import { usePersistent } from "@/lib/storage";

// The Weekly Special: one longer run a week, the same for everybody, played
// once. Its puzzles are dealt like an expedition's, from a seed made of the
// week number, so every page deals the same ones and the server only keeps
// the scores (api/src/leagues.ts). The themes take turns, week after week.

export type WeeklyTheme = {
  id: string;
  title: Localized;
  blurb: Localized;
  family: FamilyId;
  rounds: Partial<Record<GameSlug, number>>;
  order: ExpeditionSettings["order"];
  /** Seconds per puzzle; 0 for none. */
  timeLimit: number;
};

export const WEEKLY_THEMES: WeeklyTheme[] = [
  {
    id: "grand-tour",
    title: { en: "Grand Tour", pt: "Grande Volta" },
    blurb: {
      en: "One puzzle from each daily and a city to pin: a lap around everything the site does.",
      pt: "Um desafio de cada diário e uma cidade para marcar: uma volta por tudo que o site tem.",
    },
    family: "where",
    rounds: { "who-when-where": 1, wayfarer: 1, "dig-site": 1, "first-to-last": 1, outline: 1, "pin-the-city": 1 },
    order: "alternate",
    timeLimit: 0,
  },
  {
    id: "time-travellers",
    title: { en: "Time Travellers", pt: "Viajantes do Tempo" },
    blurb: {
      en: "Years, eras and lifetimes. Put history in order and pin down when it all happened.",
      pt: "Anos, eras e vidas inteiras. Ponha a história em ordem e descubra quando tudo aconteceu.",
    },
    family: "when",
    rounds: { "who-when-where": 2, "first-to-last": 1, lifelines: 1, "same-year": 1, "earlier-or-later": 1 },
    order: "alternate",
    timeLimit: 0,
  },
  {
    id: "faces-of-history",
    title: { en: "Faces of History", pt: "Rostos da História" },
    blurb: {
      en: "Famous lives from every age: who they were, where they were born and whether they could have met.",
      pt: "Vidas famosas de todas as épocas: quem foram, onde nasceram e se poderiam ter se encontrado.",
    },
    family: "who",
    rounds: { "who-when-where": 2, "clue-ladder": 2, "born-here": 1, "could-they-meet": 1 },
    order: "alternate",
    timeLimit: 0,
  },
  {
    id: "shapes-and-flags",
    title: { en: "Shapes and Flags", pt: "Formas e Bandeiras" },
    blurb: {
      en: "Silhouettes, borders and flags. No map labels to lean on this time.",
      pt: "Silhuetas, fronteiras e bandeiras. Desta vez sem nomes no mapa para ajudar.",
    },
    family: "shapes",
    rounds: { outline: 2, overland: 1, "border-chain": 1, "flag-peek": 2 },
    order: "alternate",
    timeLimit: 0,
  },
  {
    id: "lost-and-found",
    title: { en: "Lost and Found", pt: "Achados e Perdidos" },
    blurb: {
      en: "Buried cities and long journeys. Dig, follow the route, then find the city on the map.",
      pt: "Cidades soterradas e grandes viagens. Escave, siga a rota e depois ache a cidade no mapa.",
    },
    family: "where",
    rounds: { "dig-site": 3, wayfarer: 2, "pin-the-city": 1 },
    order: "grouped",
    timeLimit: 0,
  },
  {
    id: "speed-round",
    title: { en: "Speed Round", pt: "Rodada Relâmpago" },
    blurb: {
      en: "Eight quick puzzles from eight games, one minute each. Think fast.",
      pt: "Oito desafios rápidos de oito jogos, um minuto cada. Pense rápido.",
    },
    family: "numbers",
    rounds: {
      "who-when-where": 1,
      outline: 1,
      "flag-peek": 1,
      "higher-or-lower": 1,
      "earlier-or-later": 1,
      "pin-the-city": 1,
      "same-year": 1,
      "click-the-country": 1,
    },
    order: "shuffle",
    timeLimit: 60,
  },
];

/** This week's theme: they take turns, starting with the Grand Tour in week 1. */
export const themeOfWeek = (week: number): WeeklyTheme =>
  WEEKLY_THEMES[(((week - 1) % WEEKLY_THEMES.length) + WEEKLY_THEMES.length) % WEEKLY_THEMES.length];

/** Which puzzles the week deals: the same seed on every page. */
export const weeklySeed = (week: number): string => `weekly-${week}`;

/** The run's rules: the theme's games, at the standard tries. */
export function weeklySettings(week: number): ExpeditionSettings {
  const theme = themeOfWeek(week);
  const rounds = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.rounds).map((slug) => [slug, 0]));
  return normalizeSettings({
    ...DEFAULT_SETTINGS,
    rounds: { ...rounds, ...theme.rounds },
    order: theme.order,
    timeLimit: theme.timeLimit,
  });
}

/** A week's Special on this device: the run, and whether its score reached the board. */
export type WeeklyStored = {
  week: number;
  run: Run | null;
  sent: boolean;
  /** The challenge made from the finished run, so sharing twice reuses it. */
  challenge?: string;
};

/** The run of a week's Special on this device, if any. */
export function useWeeklyRun(week: number) {
  return usePersistent<WeeklyStored>(`weekly:${week}`, { week, run: null, sent: false });
}
