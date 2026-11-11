import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "dig-site",
  title: "Dig Site",
  theme: { en: "Lost cities", pt: "Cidades perdidas" },
  blurb: {
    en: "A lost city is buried somewhere on the map. Every dig draws a ring it lies on. Find it in five.",
    pt: "Uma cidade perdida está enterrada em algum lugar do mapa. Cada escavação desenha um anel onde ela está. Ache-a em cinco.",
  },
  description: "A lost city is buried somewhere on the map. Every dig draws a ring it lies on. Find it in five.",
  family: "where",
  engine: "pin",
  save: { key: "dig-site:v1", progressField: "digs" },
  status: "detail",
  expedition: {
    about: { en: "Find the buried city", pt: "Ache a cidade enterrada" },
    tries: {
      label: { en: "Digs in Dig Site", pt: "Escavações no Dig Site" },
      min: 3,
      max: 6,
      presets: { relaxed: 6, standard: 5, hard: 4 },
      legacy: "digs",
    },
  },
});
