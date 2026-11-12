import { defineGame } from "../platform/definition";

export const definition = defineGame({
  slug: "higher-or-lower",
  title: "Higher or Lower",
  theme: { en: "Country facts", pt: "Números dos países" },
  blurb: {
    en: "Two countries: which has more people, more land, longer lives? Twenty rounds, three lives.",
    pt: "Dois países: qual tem mais gente, mais terra, vida mais longa? Vinte rodadas, três vidas.",
  },
  description: "Two countries: which has the higher population, area, income or life expectancy? Twenty rounds, three lives.",
  family: "numbers",
  engine: "pick",
  save: { key: "higher-or-lower:v1", progressField: "moves", lists: ["ids"] },
  status: "detail",
  credit: { text: "World Bank Open Data (CC BY 4.0)", href: "https://data.worldbank.org/" },
  variants: [
    { id: "mixed", name: { en: "Everything", pt: "Tudo" } },
    { id: "population", name: { en: "Population", pt: "População" } },
    { id: "area", name: { en: "Area", pt: "Área" } },
    { id: "gdpPerCapita", name: { en: "Income per person", pt: "Renda por pessoa" } },
    { id: "lifeExpectancy", name: { en: "Life expectancy", pt: "Expectativa de vida" } },
  ],
  expedition: {
    about: { en: "Which country has more?", pt: "Qual país tem mais?" },
  },
});
