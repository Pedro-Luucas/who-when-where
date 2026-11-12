import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "year-snap",
  title: "Year Snap",
  theme: { en: "Dating photos", pt: "Datando fotos" },
  blurb: {
    en: "Five historical photos. Set the year each one was taken on the dial: the closer, the more points.",
    pt: "Cinco fotos históricas. Marque no seletor o ano em que cada uma foi tirada: quanto mais perto, mais pontos.",
  },
  description: "Five historical photos: guess the year each one was taken. The closer you get, the more points.",
  family: "when",
  engine: "pin",
  save: { key: "year-snap:v1", progressField: "moves", lists: ["ids"] },
  status: "points",
  credit: { text: "Wikimedia Commons", href: "https://commons.wikimedia.org/" },
  expedition: {
    about: { en: "When was this photo taken?", pt: "Quando esta foto foi tirada?" },
  },
});
