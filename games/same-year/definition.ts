import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "same-year",
  title: "Same Year",
  theme: { en: "Odd one out", pt: "O intruso" },
  blurb: {
    en: "Four moments in history: three happened in the same year. Spot the odd one out, ten times.",
    pt: "Quatro momentos da história: três aconteceram no mesmo ano. Ache o intruso, dez vezes.",
  },
  description: "Four moments in history: three happened in the same year. Spot the odd one out.",
  family: "when",
  tier: "pro",
  engine: "pick",
  save: { key: "same-year:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "Wikidata (CC0)", href: "https://www.wikidata.org/" },
  expedition: {
    about: { en: "Which one is from another year?", pt: "Qual é de outro ano?" },
  },
});
