import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "landmark-lens",
  title: "Landmark Lens",
  theme: { en: "Landmarks", pt: "Monumentos" },
  blurb: {
    en: "Five photos of famous places. Drop a pin where each one is: the closer, the more points, with a bonus for the right country.",
    pt: "Cinco fotos de lugares famosos. Marque no mapa onde cada um fica: quanto mais perto, mais pontos, com bônus pelo país certo.",
  },
  description:
    "Five photos of famous landmarks: pin where each one is. Scored by distance, with a bonus for the right country.",
  family: "where",
  engine: "pin",
  save: { key: "landmark-lens:v1", progressField: "moves", lists: ["ids"] },
  status: "points",
  credit: {
    text: "Wikidata (CC0) · Wikimedia Commons",
    href: "https://commons.wikimedia.org/",
  },
  expedition: {
    about: { en: "Where is this landmark?", pt: "Onde fica este monumento?" },
  },
});
