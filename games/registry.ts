import type { ComponentType } from "react";
import type { Localized } from "@/lib/i18n";
import { WhoWhenWhereStatus } from "./who-when-where/status";

// Every game on the site. To add one: create games/<slug>/, add a route at
// app/<slug>/page.tsx, and list it here so the hub picks it up.
export type GameInfo = {
  slug: string;
  title: string;
  blurb: Localized;
  /** Client component for the hub card footer: today's progress or score. */
  Status: ComponentType;
};

export const GAMES: GameInfo[] = [
  {
    slug: "who-when-where",
    title: "Who When Where",
    blurb: {
      en: "One famous mind a day. Guess where and when they were born — and where and when they died.",
      pt: "Uma mente famosa por dia. Adivinhe onde e quando ela nasceu — e onde e quando morreu.",
    },
    Status: WhoWhenWhereStatus,
  },
];
