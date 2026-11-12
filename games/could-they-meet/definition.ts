import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "could-they-meet",
  title: "Could They Have Met?",
  theme: { en: "Lifetimes", pt: "Vidas cruzadas" },
  blurb: {
    en: "Two famous people. Were they ever alive at the same time? Ten pairs, yes or no.",
    pt: "Duas pessoas famosas. Elas chegaram a viver na mesma época? Dez duplas, sim ou não.",
  },
  description: "Two famous people: were they ever alive at the same time? Ten pairs, yes or no.",
  family: "who",
  engine: "pick",
  save: { key: "could-they-meet:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "Wikidata (CC0)", href: "https://www.wikidata.org/" },
  expedition: {
    about: { en: "Did their lives overlap?", pt: "As vidas deles se cruzaram?" },
  },
});
