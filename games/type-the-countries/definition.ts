import { REGION_VARIANTS } from "../engines/regions";
import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "type-the-countries",
  title: "Type the Countries",
  theme: { en: "Against the clock", pt: "Contra o relógio" },
  blurb: {
    en: "Name as many countries as you can in eight minutes. Each one lights up on the map.",
    pt: "Escreva o nome de quantos países conseguir em oito minutos. Cada um se acende no mapa.",
  },
  description: "Name as many of the world's countries as you can in eight minutes; each one lights up on the map.",
  family: "where",
  engine: "name",
  save: { key: "type-the-countries:v1", progressField: "moves", lists: ["ids"] },
  status: "points",
  variants: REGION_VARIANTS,
  expedition: {
    about: { en: "Name every country you can", pt: "Nomeie todos os países que puder" },
  },
});
