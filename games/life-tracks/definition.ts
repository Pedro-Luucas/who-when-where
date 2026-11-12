import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "life-tracks",
  title: "Life Tracks",
  theme: { en: "A life on the map", pt: "Uma vida no mapa" },
  blurb: {
    en: "A famous life as a route on the map: the places they lived, one at a time. Name the person in as few stops as you can.",
    pt: "Uma vida famosa como um trajeto no mapa: os lugares onde a pessoa viveu, um de cada vez. Descubra quem é com o mínimo de paradas.",
  },
  description: "A famous person's life as a route on the map, revealed place by place. Name them in as few stops as you can.",
  family: "who",
  tier: "pro",
  engine: "name",
  save: { key: "life-tracks:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "Wikidata (CC0)", href: "https://www.wikidata.org/" },
  expedition: {
    about: { en: "Whose life is this route?", pt: "De quem é este trajeto?" },
    tries: {
      label: { en: "Guesses in Life Tracks", pt: "Palpites no Life Tracks" },
      min: 3,
      max: 6,
      presets: { relaxed: 6, standard: 5, hard: 4 },
    },
  },
});
