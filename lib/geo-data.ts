import type { Localized } from "./i18n";
import regions from "./data/regions.json";
import cities from "./data/cities.json";
import facts from "./data/country-facts.json";

// Geography beyond the map, for the games that need it (Pin the City, Click
// the Country, Flag Peek, Higher or Lower). Imported by game data modules
// only, so no page pays for it unless it plays one of them.
//
//   data/regions.json        the continent of each country — Natural Earth
//                            admin 0 countries (public domain); scripts/build-regions.mjs
//   data/cities.json         capitals and big cities — Natural Earth populated
//                            places (public domain); scripts/build-cities.mjs
//   data/country-facts.json  population, GDP per person… — World Bank Open
//                            Data (CC BY 4.0, credit shown in the game);
//                            scripts/fetch-country-facts.mjs
//
// The flags (public/flags/<id>.svg) are from flag-icons (MIT); scripts/build-flags.mjs.
// Don't edit the JSON by hand: fix the scripts and run them again.

export const REGIONS = ["africa", "asia", "europe", "north-america", "south-america", "oceania"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_NAMES: Record<Region, Localized> = {
  africa: { en: "Africa", pt: "África" },
  asia: { en: "Asia", pt: "Ásia" },
  europe: { en: "Europe", pt: "Europa" },
  "north-america": { en: "North America", pt: "América do Norte" },
  "south-america": { en: "South America", pt: "América do Sul" },
  oceania: { en: "Oceania", pt: "Oceania" },
};

const regionById = regions as Record<string, Region>;

/** The continent a country (by its ISO code, "br") is played in. */
export const regionOf = (countryId: string): Region | undefined => regionById[countryId];

export type City = {
  /** "sao-paulo-br" */
  id: string;
  name: Localized;
  /** The country's ISO code. */
  country: string;
  lat: number;
  lon: number;
  /** People in the city and its metropolitan area. */
  pop: number;
  /** The country's capital (or the seat of a territory that has none). */
  capital: boolean;
};

/** Biggest first. */
export const CITIES = cities as City[];

const citiesById = new Map(CITIES.map((city) => [city.id, city]));

export const cityById = (id: string): City | undefined => citiesById.get(id);

export type CountryFacts = {
  population?: number;
  /** US dollars, current. */
  gdpPerCapita?: number;
  /** Years, at birth. */
  lifeExpectancy?: number;
  /** Share of people living in towns and cities, %. */
  urban?: number;
  /** Share of the land under forest, %. */
  forest?: number;
  /** The year most of the figures are from. */
  year: number;
};

export const FACTS = facts.facts as Record<string, CountryFacts>;

export const factsOf = (countryId: string): CountryFacts | undefined => FACTS[countryId];

/** Where the facts come from, for the credit line. */
export const FACTS_SOURCE = { name: facts.source, licence: facts.licence, url: facts.url };

/** A country's flag, served from public/flags. */
export const flagSrc = (countryId: string): string => `/flags/${countryId}.svg`;
