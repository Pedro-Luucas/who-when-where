import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "quickplay",
  title: "Quickplay",
  theme: { en: "A bit of everything", pt: "Um pouco de tudo" },
  blurb: {
    en: "Ten quick questions, each from a different game: people, dates, flags, maps and numbers.",
    pt: "Dez perguntas rápidas, cada uma de um jogo diferente: pessoas, datas, bandeiras, mapas e números.",
  },
  description: "Ten quick questions, each from a different game: people, dates, flags, places and numbers.",
  family: "words",
  engine: "pick",
  save: { key: "quickplay:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  expedition: {
    about: { en: "Ten mixed questions", pt: "Dez perguntas variadas" },
  },
});
