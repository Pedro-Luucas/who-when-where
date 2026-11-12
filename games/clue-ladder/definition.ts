import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "clue-ladder",
  title: "Clue Ladder",
  theme: { en: "Who am I?", pt: "Quem sou eu?" },
  blurb: {
    en: "A hidden person and six clues, from vague to obvious. Guess at any rung: the fewer clues, the more points.",
    pt: "Uma pessoa escondida e seis pistas, das vagas às óbvias. Chute quando quiser: menos pistas, mais pontos.",
  },
  description: "A hidden person and six clues, from vague to obvious. Name them with as few clues as you can.",
  family: "who",
  engine: "name",
  save: { key: "clue-ladder:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "Wikidata (CC0)", href: "https://www.wikidata.org/" },
  expedition: {
    about: { en: "Name the person from clues", pt: "Descubra a pessoa pelas pistas" },
    tries: {
      label: { en: "Guesses in Clue Ladder", pt: "Palpites no Clue Ladder" },
      min: 3,
      max: 6,
      presets: { relaxed: 6, standard: 6, hard: 4 },
    },
  },
});
