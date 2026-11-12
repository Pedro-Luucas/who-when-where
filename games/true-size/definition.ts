import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "true-size",
  title: "True Size",
  theme: { en: "Real sizes", pt: "Tamanhos reais" },
  blurb: {
    en: "Two countries as the usual map draws them. Which is really bigger, and by how much? Then see them at true scale.",
    pt: "Dois países como o mapa de sempre desenha. Qual é maior de verdade, e quanto? Depois veja os dois em escala real.",
  },
  description: "Two countries as the usual map draws them: which is really bigger, and by how much? Then compare them at true scale.",
  family: "shapes",
  tier: "pro",
  engine: "pick",
  save: { key: "true-size:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "Natural Earth (public domain)", href: "https://www.naturalearthdata.com/" },
  expedition: {
    about: { en: "Which country is really bigger?", pt: "Qual país é maior de verdade?" },
  },
});
