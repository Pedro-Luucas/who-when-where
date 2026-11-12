import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "lifelines",
  title: "Lifelines",
  theme: { en: "Birth order", pt: "Ordem de nascimento" },
  blurb: {
    en: "Five famous people. Put them in the order they were born; the right places lock. Three tries.",
    pt: "Cinco pessoas famosas. Ponha na ordem em que nasceram; as posições certas travam. Três tentativas.",
  },
  description: "Five famous people: put them in the order they were born. The right places lock. Three tries.",
  family: "when",
  engine: "order",
  save: { key: "lifelines:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "Wikidata (CC0)", href: "https://www.wikidata.org/" },
  expedition: {
    about: { en: "Who was born first?", pt: "Quem nasceu primeiro?" },
    tries: {
      label: { en: "Attempts in Lifelines", pt: "Tentativas no Lifelines" },
      min: 1,
      max: 4,
      presets: { relaxed: 4, standard: 3, hard: 2 },
    },
  },
});
