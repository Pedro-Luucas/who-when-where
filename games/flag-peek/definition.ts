import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "flag-peek",
  title: "Flag Peek",
  theme: { en: "Flags", pt: "Bandeiras" },
  blurb: {
    en: "A flag hidden under tiles. Every wrong guess lifts more of them. Name the country in six.",
    pt: "Uma bandeira escondida sob peças. Cada palpite errado revela mais. Descubra o país em seis.",
  },
  description: "A flag hidden under tiles; every wrong guess lifts more of them. Name the country in six guesses.",
  family: "flags",
  engine: "name",
  save: { key: "flag-peek:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "flag-icons (MIT)", href: "https://github.com/lipis/flag-icons" },
  expedition: {
    about: { en: "Name the country by its flag", pt: "Descubra o país pela bandeira" },
    tries: {
      label: { en: "Guesses in Flag Peek", pt: "Palpites no Flag Peek" },
      min: 3,
      max: 6,
      presets: { relaxed: 6, standard: 6, hard: 4 },
    },
  },
});
