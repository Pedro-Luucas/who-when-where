import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "outline",
  title: "Outline",
  theme: { en: "Shapes", pt: "Contornos" },
  blurb: {
    en: "A country, cut out of the map. Every miss tells you how far away it is, and which way. Name it in six.",
    pt: "Um país, recortado do mapa. Cada erro diz a que distância ele está, e em que direção. Descubra em seis.",
  },
  description:
    "A country, cut out of the map. Every miss tells you how far away it is, and which way. Name it in six.",
  family: "shapes",
  engine: "name",
  save: { key: "outline:v1", progressField: "guesses" },
  status: "detail",
  expedition: {
    about: { en: "Name the country by its shape", pt: "Descubra o país pelo contorno" },
    tries: {
      label: { en: "Guesses in Outline", pt: "Palpites no Outline" },
      min: 3,
      max: 6,
      presets: { relaxed: 6, standard: 6, hard: 4 },
      legacy: "guesses",
    },
  },
});
