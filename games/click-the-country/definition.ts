import { REGION_VARIANTS } from "../engines/regions";
import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "click-the-country",
  title: "Click the Country",
  theme: { en: "Countries", pt: "Países" },
  blurb: {
    en: "A country's name: tap it on the map. Three tries each, ten countries.",
    pt: "O nome de um país: toque nele no mapa. Três tentativas cada, dez países.",
  },
  description: "A country's name: find it and tap it on the map. Three tries per country, ten countries a day.",
  family: "where",
  engine: "pin",
  save: { key: "click-the-country:v1", progressField: "moves", lists: ["ids"] },
  status: "points",
  credit: { text: "Natural Earth (public domain)", href: "https://www.naturalearthdata.com/" },
  variants: REGION_VARIANTS,
  expedition: {
    about: { en: "Find the country on the map", pt: "Ache o país no mapa" },
    tries: {
      label: { en: "Tries per country in Click the Country", pt: "Tentativas por país no Click the Country" },
      min: 1,
      max: 3,
      presets: { relaxed: 3, standard: 3, hard: 2 },
    },
  },
});
