import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "gauntlet",
  title: "Gauntlet",
  theme: { en: "Survival", pt: "Sobrevivência" },
  blurb: {
    en: "Questions from every game, each one harder than the last. Three lives: how far can you get?",
    pt: "Perguntas de todos os jogos, cada uma mais difícil que a anterior. Três vidas: até onde você chega?",
  },
  description: "Survival: questions from every game, harder and harder. Three lives — how far can you get?",
  family: "words",
  engine: "pick",
  save: { key: "gauntlet:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  expedition: {
    about: { en: "Mixed questions, harder and harder", pt: "Perguntas variadas, cada vez mais difíceis" },
  },
});
