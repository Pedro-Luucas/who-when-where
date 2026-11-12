import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "born-here",
  title: "Born Here",
  theme: { en: "Birthplaces", pt: "Terra natal" },
  blurb: {
    en: "A town lights up on the map. Which of four famous people was born there? Ten rounds.",
    pt: "Uma cidade se acende no mapa. Qual destas quatro pessoas famosas nasceu ali? Dez rodadas.",
  },
  description: "A town lights up on the map: which of four famous people was born there? Ten rounds.",
  family: "who",
  engine: "pick",
  save: { key: "born-here:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "Wikidata (CC0)", href: "https://www.wikidata.org/" },
  variants: [
    { id: "classic", name: { en: "Ten rounds", pt: "Dez rodadas" } },
    { id: "survival", name: { en: "Survival · 3 lives", pt: "Sobrevivência · 3 vidas" } },
  ],
  expedition: {
    about: { en: "Who was born in this town?", pt: "Quem nasceu nesta cidade?" },
  },
});
