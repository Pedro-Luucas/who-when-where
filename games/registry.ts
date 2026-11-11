import type { ComponentType } from "react";
import type { Localized } from "@/lib/i18n";
import { GAME_THEMES } from "./slugs";
import { DigSiteStatus } from "./dig-site/status";
import { FirstToLastStatus } from "./first-to-last/status";
import { OutlineStatus } from "./outline/status";
import { OverlandStatus } from "./overland/status";
import { WayfarerStatus } from "./wayfarer/status";
import { WhoWhenWhereStatus } from "./who-when-where/status";

// Every game on the site. To add one: create games/<slug>/, add a route at
// app/<slug>/page.tsx, and list it here so the hub picks it up.
export type GameInfo = {
  slug: string;
  title: string;
  /** One or two words on what the game is about, shown above the title. */
  theme: Localized;
  blurb: Localized;
  /** Client component for the hub card footer: today's progress or score. */
  Status: ComponentType;
};

export const GAMES: GameInfo[] = [
  {
    slug: "who-when-where",
    title: "Who When Where",
    theme: GAME_THEMES["who-when-where"],
    blurb: {
      en: "One famous mind a day. Guess where and when they were born — and where and when they died.",
      pt: "Uma mente famosa por dia. Adivinhe onde e quando ela nasceu — e onde e quando morreu.",
    },
    Status: WhoWhenWhereStatus,
  },
  {
    slug: "wayfarer",
    title: "Wayfarer",
    theme: GAME_THEMES.wayfarer,
    blurb: {
      en: "A famous journey is traced on the map, one stretch at a time. Name it in six tries.",
      pt: "Uma viagem famosa é traçada no mapa, um trecho de cada vez. Descubra qual é em seis tentativas.",
    },
    Status: WayfarerStatus,
  },
  {
    slug: "dig-site",
    title: "Dig Site",
    theme: GAME_THEMES["dig-site"],
    blurb: {
      en: "A lost city is buried somewhere on the map. Every dig draws a ring it lies on. Find it in five.",
      pt: "Uma cidade perdida está enterrada em algum lugar do mapa. Cada escavação desenha um anel onde ela está. Ache-a em cinco.",
    },
    Status: DigSiteStatus,
  },
  {
    slug: "first-to-last",
    title: "First to Last",
    theme: GAME_THEMES["first-to-last"],
    blurb: {
      en: "Six moments in history, pinned where they happened. Tap them in order, earliest first.",
      pt: "Seis momentos da história, marcados onde aconteceram. Toque neles em ordem, do mais antigo ao mais recente.",
    },
    Status: FirstToLastStatus,
  },
  {
    slug: "overland",
    title: "Overland",
    theme: GAME_THEMES.overland,
    blurb: {
      en: "Two countries, and everything between them. Name the countries that join them, border to border.",
      pt: "Dois países, e tudo o que há entre eles. Diga os países que ligam um ao outro, de fronteira em fronteira.",
    },
    Status: OverlandStatus,
  },
  {
    slug: "outline",
    title: "Outline",
    theme: GAME_THEMES.outline,
    blurb: {
      en: "A country, cut out of the map. Every miss tells you how far away it is, and which way. Name it in six.",
      pt: "Um país, recortado do mapa. Cada erro diz a que distância ele está, e em que direção. Descubra em seis.",
    },
    Status: OutlineStatus,
  },
];
