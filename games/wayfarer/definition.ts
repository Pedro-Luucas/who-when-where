import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "wayfarer",
  title: "Wayfarer",
  theme: { en: "Journeys", pt: "Viagens" },
  blurb: {
    en: "A famous journey is traced on the map, one stretch at a time. Name it in six tries.",
    pt: "Uma viagem famosa é traçada no mapa, um trecho de cada vez. Descubra qual é em seis tentativas.",
  },
  description: "One famous journey a day, traced on the map a stretch at a time. Can you name it in six tries?",
  family: "where",
  engine: "name",
  save: { key: "wayfarer:v1", progressField: "guesses" },
  status: "detail",
  expedition: {
    about: { en: "Name the journey", pt: "Descubra a viagem" },
    tries: {
      label: { en: "Guesses in Wayfarer", pt: "Palpites no Wayfarer" },
      min: 3,
      max: 6,
      presets: { relaxed: 6, standard: 6, hard: 4 },
      legacy: "guesses",
    },
  },
});
