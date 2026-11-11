import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "overland",
  title: "Overland",
  theme: { en: "Borders", pt: "Fronteiras" },
  blurb: {
    en: "Two countries, and everything between them. Name the countries that join them, border to border.",
    pt: "Dois países, e tudo o que há entre eles. Diga os países que ligam um ao outro, de fronteira em fronteira.",
  },
  description:
    "Two countries, and everything that lies between them. Name the countries that join them, border to border.",
  family: "shapes",
  engine: "name",
  save: { key: "overland:v1", progressField: "guesses" },
  status: "detail",
  expedition: {
    about: { en: "Join two countries, border to border", pt: "Ligue dois países, de fronteira em fronteira" },
    // Guesses allowed beyond the fewest that could do it.
    tries: {
      label: { en: "Spare guesses in Overland", pt: "Palpites de sobra no Overland" },
      min: 1,
      max: 5,
      presets: { relaxed: 5, standard: 4, hard: 2 },
      legacy: "spare",
    },
  },
});
