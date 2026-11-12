import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "border-chain",
  title: "Border Chain",
  theme: { en: "Neighbours", pt: "Vizinhos" },
  blurb: {
    en: "Get from one country to another by land: each country you name must border the last. Fewest steps wins.",
    pt: "Vá de um país a outro por terra: cada país que você nomeia precisa fazer fronteira com o anterior. Menos passos, mais pontos.",
  },
  description: "Get from one country to another by land, naming neighbours one by one, in as few steps as you can.",
  family: "shapes",
  engine: "name",
  save: { key: "border-chain:v1", progressField: "moves", lists: ["ids"] },
  status: "points",
  credit: { text: "Natural Earth (public domain)", href: "https://www.naturalearthdata.com/" },
  expedition: {
    about: { en: "Cross borders to reach the target", pt: "Cruze fronteiras até o destino" },
  },
});
