import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "timeline",
  title: "Timeline",
  theme: { en: "Build a timeline", pt: "Monte a linha do tempo" },
  blurb: {
    en: "One moment of history after another: slot each new card into the right gap of your timeline. Three mistakes and it's over.",
    pt: "Um momento da história atrás do outro: encaixe cada carta nova no vão certo da sua linha do tempo. Três erros e acabou.",
  },
  description: "Build a timeline of history: slot each new card into the right gap. Three mistakes allowed; every card placed scores.",
  family: "when",
  engine: "order",
  save: { key: "timeline:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  expedition: {
    about: { en: "Slot events into a timeline", pt: "Encaixe fatos na linha do tempo" },
    tries: {
      label: { en: "Mistakes allowed in Timeline", pt: "Erros permitidos no Timeline" },
      min: 1,
      max: 5,
      presets: { relaxed: 5, standard: 3, hard: 2 },
    },
  },
});
