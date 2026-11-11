import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "who-when-where",
  title: "Who When Where",
  theme: { en: "Lives", pt: "Vidas" },
  blurb: {
    en: "One famous mind a day. Guess where and when they were born — and where and when they died.",
    pt: "Uma mente famosa por dia. Adivinhe onde e quando ela nasceu — e onde e quando morreu.",
  },
  description: "One famous mind a day. Guess where and when they were born — and where and when they died.",
  family: "who",
  engine: "mixed",
  save: { key: "who-when-where:v1", progressField: "guesses" },
  status: "points",
  expedition: {
    about: { en: "A life: two places, two years", pt: "Uma vida: dois lugares, dois anos" },
  },
});
