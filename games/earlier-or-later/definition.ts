import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "earlier-or-later",
  title: "Earlier or Later",
  theme: { en: "Chronology", pt: "Cronologia" },
  blurb: {
    en: "One moment in history after another: did the new one happen before or after the last? Three lives.",
    pt: "Um momento da história atrás do outro: o novo aconteceu antes ou depois do anterior? Três vidas.",
  },
  description: "One moment in history after another: did the new one happen before or after the last? Three lives.",
  family: "when",
  engine: "pick",
  save: { key: "earlier-or-later:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  expedition: {
    about: { en: "Before or after?", pt: "Antes ou depois?" },
  },
});
