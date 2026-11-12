import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "rivers-and-ranges",
  title: "Rivers & Ranges",
  theme: { en: "Rivers and mountains", pt: "Rios e montanhas" },
  blurb: {
    en: "A great river or mountain range is drawn on the map. Name it, then name the countries it runs through.",
    pt: "Um grande rio ou cadeia de montanhas aparece no mapa. Diga qual é, depois diga os países por onde passa.",
  },
  description: "A river or mountain range is drawn on the map: name it, then name the countries it passes through.",
  family: "where",
  tier: "pro",
  engine: "name",
  save: { key: "rivers-and-ranges:v1", progressField: "moves", lists: ["ids"] },
  status: "points",
  credit: { text: "Natural Earth (public domain)", href: "https://www.naturalearthdata.com/" },
  expedition: {
    about: { en: "Name the river or range", pt: "Diga o rio ou a cordilheira" },
  },
});
