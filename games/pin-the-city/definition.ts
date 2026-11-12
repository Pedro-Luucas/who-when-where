import { REGION_VARIANTS } from "../engines/regions";
import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "pin-the-city",
  title: "Pin the City",
  theme: { en: "Cities", pt: "Cidades" },
  blurb: {
    en: "A city's name: drop a pin where it is. The closer, the more points. Ten cities.",
    pt: "O nome de uma cidade: marque onde ela fica. Quanto mais perto, mais pontos. Dez cidades.",
  },
  description: "A city's name: drop a pin where it is on the map. Scored by distance, ten cities a day.",
  family: "where",
  engine: "pin",
  save: { key: "pin-the-city:v1", progressField: "moves", lists: ["ids"] },
  status: "points",
  credit: { text: "Natural Earth (public domain)", href: "https://www.naturalearthdata.com/" },
  variants: REGION_VARIANTS,
  expedition: {
    about: { en: "Pin the city on the map", pt: "Marque a cidade no mapa" },
  },
});
