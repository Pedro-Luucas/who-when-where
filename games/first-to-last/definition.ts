import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "first-to-last",
  title: "First to Last",
  theme: { en: "Chronology", pt: "Cronologia" },
  blurb: {
    en: "Six moments in history, pinned where they happened. Tap them in order, earliest first.",
    pt: "Seis momentos da história, marcados onde aconteceram. Toque neles em ordem, do mais antigo ao mais recente.",
  },
  description: "Six moments in history, pinned where they happened. Put them in order, earliest first.",
  family: "when",
  engine: "order",
  // `ids` are the day's events in lettered order, so a pool change can't reshuffle a saved day.
  save: { key: "first-to-last:v1", progressField: "attempts", lists: ["ids"] },
  status: "detail",
  expedition: {
    about: { en: "Put history in order", pt: "Ponha a história em ordem" },
    tries: {
      label: { en: "Attempts in First to Last", pt: "Tentativas no First to Last" },
      min: 1,
      max: 4,
      presets: { relaxed: 4, standard: 3, hard: 2 },
      legacy: "attempts",
    },
  },
});
