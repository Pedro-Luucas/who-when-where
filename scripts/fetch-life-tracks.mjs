// Builds games/life-tracks/data/tracks.json — a life as a route on the map —
// for the people of lib/data/notables.json, from Wikidata (CC0):
//
//   node scripts/fetch-life-tracks.mjs
//
// For each notable it asks for the places of their life with their dates:
// residence (P551), work location (P937), educated at (P69) and employer
// (P108), each with start (P580), end (P582) or point-in-time (P585)
// qualifiers. An institution is put on the map at its own coordinates, else
// at its headquarters (P159), the place it is in (P131) or its location (P276).
//
// Every stop is named by its town: a district, a house or a university in a
// big city is named by the city (lib/data/cities.json), an institution
// elsewhere by the place it is in (P131). The institution itself is kept
// (`at`) for the reveal at the end.
//
// The route: birth place (born year) → the dated places in between, by year →
// death place (died year). Places without coordinates or a year, and whole
// countries, states or continents, are dropped, as are places closer than
// MERGE_KM to the stop before them (one city, one stop). A stop whose name
// carries the person's own name (a town named after them) is dropped too:
// the map must not give the answer away. People with fewer than MIN_STOPS
// stops are left out.
//
// Responses are cached in scripts/.cache (delete it to refresh).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ROOT, getJson } from "./lib/wiki.mjs";

const NOTABLES = path.join(ROOT, "lib/data/notables.json");
const CITIES = path.join(ROOT, "lib/data/cities.json");
const COUNTRIES = path.join(ROOT, "lib/data/countries.json");
const OUT_DIR = path.join(ROOT, "games/life-tracks/data");
const OUT = path.join(OUT_DIR, "tracks.json");
const SPARQL = "https://query.wikidata.org/sparql?format=json&query=";

const MERGE_KM = 40;
const MIN_STOPS = 4;
/** Long lives are thinned to this many stops (birth and death always kept). */
const MAX_STOPS = 10;
const BATCH = 50;

/** Too big to be a stop: countries, constituent countries, historical countries, states, continents. */
const TOO_BIG = ["Q6256", "Q3624078", "Q5107", "Q3336843", "Q3024240", "Q7275", "Q35657", "Q1250464", "Q417175", "Q82794", "Q107390", "Q10864048"];

// A few lives whose Wikidata places are too thin for a route, filled in by
// hand: [place en, place pt, lat, lon, year, kind]. They go between birth and
// death like the fetched stops, and may also give a death place Wikidata lacks.
const OVERRIDES = {
  "charles-darwin": {
    stops: [
      ["Salvador", "Salvador", -12.97, -38.5, 1832, "lived"],
      ["Sydney", "Sydney", -33.87, 151.21, 1836, "lived"],
      ["London", "Londres", 51.51, -0.13, 1837, "lived"],
    ],
  },
  "mahatma-gandhi": {
    stops: [
      ["Rajkot", "Rajkot", 22.3, 70.8, 1881, "studied"],
      ["Durban", "Durban", -29.86, 31.02, 1893, "lived"],
      ["Johannesburg", "Joanesburgo", -26.2, 28.05, 1903, "lived"],
      ["Ahmedabad", "Ahmedabad", 23.03, 72.58, 1917, "lived"],
    ],
    died: ["New Delhi", "Nova Déli", 28.61, 77.21],
  },
  "carl-linnaeus": { died: ["Uppsala", "Upsália", 59.86, 17.64] },
  "louisa-may-alcott": { died: ["Boston", "Boston", 42.36, -71.06] },
  "henrik-ibsen": { died: ["Oslo", "Oslo", 59.91, 10.75] },
  // Wikidata puts these institutions where they are today, not where they were then.
  "alan-turing": { drop: ["Benhall"] },
  "john-f-kennedy": { drop: ["Connecticut"] },
  "leonardo-da-vinci": { stops: [["Rome", "Roma", 41.9, 12.5, 1513, "lived"]] },
  "frida-kahlo": { stops: [["San Francisco", "São Francisco", 37.77, -122.42, 1930, "lived"], ["Detroit", "Detroit", 42.33, -83.05, 1932, "lived"], ["New York City", "Nova York", 40.71, -74.01, 1933, "lived"]] },
  "sigmund-freud": { stops: [["Vienna", "Viena", 48.21, 16.37, 1860, "lived"], ["Paris", "Paris", 48.86, 2.35, 1885, "studied"]] },
  "wolfgang-amadeus-mozart": { stops: [["London", "Londres", 51.51, -0.13, 1764, "lived"], ["Milan", "Milão", 45.46, 9.19, 1770, "worked"], ["Paris", "Paris", 48.86, 2.35, 1778, "worked"]] },
  "galileo-galilei": { stops: [["Florence", "Florença", 43.77, 11.25, 1574, "lived"], ["Pisa", "Pisa", 43.72, 10.4, 1581, "studied"], ["Padua", "Pádua", 45.41, 11.88, 1592, "worked"], ["Florence", "Florença", 43.77, 11.25, 1610, "worked"], ["Siena", "Siena", 43.32, 11.33, 1633, "lived"]] },
  "mark-twain": { stops: [["Hannibal", "Hannibal", 39.71, -91.36, 1839, "lived"], ["Virginia City", "Virginia City", 39.31, -119.65, 1862, "worked"], ["San Francisco", "São Francisco", 37.77, -122.42, 1864, "worked"], ["Hartford", "Hartford", 41.76, -72.69, 1871, "lived"]] },
  "johann-sebastian-bach": { stops: [["Lüneburg", "Lüneburg", 53.25, 10.41, 1700, "studied"], ["Arnstadt", "Arnstadt", 50.83, 10.95, 1703, "worked"], ["Mühlhausen", "Mühlhausen", 51.21, 10.45, 1707, "worked"], ["Weimar", "Weimar", 50.98, 11.33, 1708, "worked"], ["Köthen", "Köthen", 51.75, 11.97, 1717, "worked"], ["Leipzig", "Leipzig", 51.34, 12.37, 1723, "worked"]] },
  "christopher-columbus": { stops: [["Lisbon", "Lisboa", 38.72, -9.14, 1477, "lived"], ["Porto Santo", "Porto Santo", 33.07, -16.34, 1479, "lived"], ["La Isabela", "La Isabela", 19.88, -71.08, 1494, "lived"]] },
  "charles-dickens": { stops: [["Chatham", "Chatham", 51.38, 0.52, 1817, "lived"], ["London", "Londres", 51.51, -0.13, 1822, "lived"], ["Genoa", "Gênova", 44.41, 8.93, 1844, "lived"], ["Lausanne", "Lausanne", 46.52, 6.63, 1846, "lived"]] },
  "leo-tolstoy": { stops: [["Kazan", "Kazan", 55.79, 49.12, 1844, "studied"], ["Sevastopol", "Sebastopol", 44.6, 33.52, 1854, "worked"], ["Moscow", "Moscou", 55.76, 37.62, 1882, "lived"]] },
  "fyodor-dostoevsky": { stops: [["Saint Petersburg", "São Petersburgo", 59.94, 30.31, 1838, "studied"], ["Omsk", "Omsk", 54.99, 73.37, 1850, "lived"], ["Semey", "Semei", 50.41, 80.23, 1854, "worked"], ["Saint Petersburg", "São Petersburgo", 59.94, 30.31, 1859, "lived"], ["Dresden", "Dresden", 51.05, 13.74, 1869, "lived"]] },
  "abraham-lincoln": { stops: [["Lincoln City", "Lincoln City", 38.12, -86.99, 1816, "lived"], ["Springfield", "Springfield", 39.8, -89.65, 1837, "lived"]] },
  "che-guevara": { stops: [["Alta Gracia", "Alta Gracia", -31.66, -64.43, 1932, "lived"], ["Guatemala City", "Cidade da Guatemala", 14.63, -90.51, 1954, "lived"], ["Mexico City", "Cidade do México", 19.43, -99.13, 1955, "lived"], ["Havana", "Havana", 23.11, -82.37, 1959, "worked"]] },
  "mao-zedong": { stops: [["Beijing", "Pequim", 39.9, 116.4, 1918, "worked"], ["Ruijin", "Ruijin", 25.89, 116.03, 1931, "lived"], ["Yan'an", "Yan'an", 36.6, 109.49, 1937, "lived"]] },
  "joseph-stalin": { stops: [["Baku", "Baku", 40.41, 49.87, 1907, "lived"], ["Kureika", "Kureika", 66.47, 87.25, 1914, "lived"], ["Saint Petersburg", "São Petersburgo", 59.94, 30.31, 1917, "worked"]] },
  "winston-churchill": { stops: [["Sandhurst", "Sandhurst", 51.35, -0.8, 1893, "studied"], ["Bangalore", "Bangalore", 12.97, 77.59, 1896, "worked"], ["Pretoria", "Pretória", -25.75, 28.19, 1899, "worked"]] },
  "nelson-mandela": { stops: [["Alice", "Alice", -32.78, 26.85, 1939, "studied"], ["Johannesburg", "Joanesburgo", -26.2, 28.05, 1941, "lived"], ["Robben Island", "Ilha Robben", -33.81, 18.37, 1964, "lived"], ["Pretoria", "Pretória", -25.75, 28.19, 1994, "worked"]] },
  "marco-polo": { stops: [["Beijing", "Pequim", 39.9, 116.4, 1275, "worked"], ["Genoa", "Gênova", 44.41, 8.93, 1298, "lived"]] },
  "thomas-edison": { stops: [["Port Huron", "Port Huron", 42.97, -82.42, 1854, "lived"], ["Boston", "Boston", 42.36, -71.06, 1868, "worked"], ["Menlo Park", "Menlo Park", 40.56, -74.34, 1876, "worked"]] },
  "benjamin-franklin": { stops: [["Philadelphia", "Filadélfia", 39.95, -75.17, 1723, "lived"], ["London", "Londres", 51.51, -0.13, 1757, "lived"], ["Paris", "Paris", 48.86, 2.35, 1776, "lived"]] },
  "george-frideric-handel": { stops: [["Hamburg", "Hamburgo", 53.55, 9.99, 1703, "worked"], ["Rome", "Roma", 41.9, 12.5, 1707, "lived"], ["Hanover", "Hanôver", 52.37, 9.74, 1710, "worked"], ["London", "Londres", 51.51, -0.13, 1712, "lived"]] },
  "james-joyce": { stops: [["Pula", "Pula", 44.87, 13.85, 1904, "worked"], ["Trieste", "Trieste", 45.65, 13.78, 1905, "worked"], ["Zürich", "Zurique", 47.37, 8.55, 1915, "lived"], ["Paris", "Paris", 48.86, 2.35, 1920, "lived"]] },
  "simon-bolivar": { stops: [["Madrid", "Madri", 40.42, -3.7, 1799, "lived"], ["Paris", "Paris", 48.86, 2.35, 1804, "lived"], ["Bogotá", "Bogotá", 4.71, -74.07, 1819, "worked"], ["Lima", "Lima", -12.05, -77.04, 1823, "worked"]] },
  "john-lennon": { stops: [["Hamburg", "Hamburgo", 53.55, 9.99, 1960, "worked"], ["London", "Londres", 51.51, -0.13, 1968, "lived"]] },
  "edgar-allan-poe": { stops: [["Richmond", "Richmond", 37.54, -77.44, 1811, "lived"], ["London", "Londres", 51.51, -0.13, 1815, "studied"], ["Richmond", "Richmond", 37.54, -77.44, 1820, "lived"], ["Baltimore", "Baltimore", 39.29, -76.61, 1831, "lived"], ["Philadelphia", "Filadélfia", 39.95, -75.17, 1838, "lived"], ["New York City", "Nova York", 40.71, -74.01, 1844, "lived"]] },
  "elvis-presley": { stops: [["Memphis", "Memphis", 35.15, -90.05, 1948, "lived"], ["Friedberg", "Friedberg", 50.34, 8.75, 1958, "worked"]] },
  "albert-camus": { stops: [["Paris", "Paris", 48.86, 2.35, 1940, "worked"], ["Lourmarin", "Lourmarin", 43.76, 5.36, 1958, "lived"]] },
  "ho-chi-minh": { stops: [["Huế", "Huế", 16.46, 107.59, 1907, "studied"], ["Paris", "Paris", 48.86, 2.35, 1919, "lived"], ["Moscow", "Moscou", 55.76, 37.62, 1923, "lived"], ["Guangzhou", "Cantão", 23.13, 113.26, 1924, "worked"]] },
  "mother-teresa": { stops: [["Dublin", "Dublin", 53.35, -6.26, 1928, "lived"], ["Darjeeling", "Darjeeling", 27.04, 88.26, 1929, "studied"], ["Kolkata", "Calcutá", 22.57, 88.36, 1931, "worked"]] },
  "freddie-mercury": { stops: [["Panchgani", "Panchgani", 17.92, 73.82, 1955, "studied"], ["Zanzibar", "Zanzibar", -6.16, 39.19, 1963, "lived"], ["London", "Londres", 51.51, -0.13, 1964, "lived"], ["Munich", "Munique", 48.14, 11.58, 1980, "lived"]] },
  "gabriel-garcia-marquez": { stops: [["Bogotá", "Bogotá", 4.71, -74.07, 1947, "studied"], ["Cartagena", "Cartagena", 10.39, -75.51, 1948, "worked"], ["Barranquilla", "Barranquilla", 10.96, -74.8, 1950, "worked"], ["Paris", "Paris", 48.86, 2.35, 1955, "lived"], ["Caracas", "Caracas", 10.49, -66.88, 1957, "worked"], ["Mexico City", "Cidade do México", 19.43, -99.13, 1961, "lived"]] },
  "anton-chekhov": { stops: [["Moscow", "Moscou", 55.76, 37.62, 1879, "studied"], ["Yalta", "Ialta", 44.5, 34.17, 1899, "lived"]] },
  "ferdinand-magellan": { stops: [["Lisbon", "Lisboa", 38.72, -9.14, 1492, "lived"], ["Kochi", "Kochi", 9.93, 76.27, 1505, "worked"], ["Malacca", "Malaca", 2.19, 102.25, 1511, "worked"], ["Seville", "Sevilha", 37.39, -5.98, 1517, "lived"]] },
  "hernan-cortes": { stops: [["Salamanca", "Salamanca", 40.97, -5.66, 1499, "studied"], ["Santo Domingo", "Santo Domingo", 18.47, -69.89, 1504, "lived"], ["Santiago de Cuba", "Santiago de Cuba", 20.02, -75.82, 1511, "lived"], ["Mexico City", "Cidade do México", 19.43, -99.13, 1521, "lived"]] },
  "rene-descartes": { stops: [["La Flèche", "La Flèche", 47.7, -0.08, 1607, "studied"], ["Poitiers", "Poitiers", 46.58, 0.34, 1616, "studied"], ["Breda", "Breda", 51.59, 4.78, 1618, "worked"], ["Amsterdam", "Amsterdã", 52.37, 4.9, 1629, "lived"]] },
  voltaire: { stops: [["London", "Londres", 51.51, -0.13, 1726, "lived"], ["Cirey-sur-Blaise", "Cirey-sur-Blaise", 48.33, 4.94, 1734, "lived"], ["Potsdam", "Potsdam", 52.4, 13.06, 1750, "lived"], ["Geneva", "Genebra", 46.2, 6.14, 1755, "lived"]] },
  "jean-jacques-rousseau": { drop: ["Staffordshire"], stops: [["Wootton", "Wootton", 52.98, -1.85, 1766, "lived"], ["Chambéry", "Chambéry", 45.57, 5.92, 1736, "lived"], ["Paris", "Paris", 48.86, 2.35, 1742, "lived"], ["Môtiers", "Môtiers", 46.91, 6.61, 1762, "lived"]] },
  "richard-wagner": { stops: [["Riga", "Riga", 56.95, 24.11, 1837, "worked"], ["Paris", "Paris", 48.86, 2.35, 1839, "lived"], ["Dresden", "Dresden", 51.05, 13.74, 1843, "worked"], ["Zürich", "Zurique", 47.37, 8.55, 1849, "lived"], ["Munich", "Munique", 48.14, 11.58, 1864, "lived"], ["Lucerne", "Lucerna", 47.05, 8.31, 1866, "lived"], ["Bayreuth", "Bayreuth", 49.94, 11.58, 1872, "lived"]] },
  "giuseppe-verdi": { stops: [["Busseto", "Busseto", 44.98, 10.04, 1823, "studied"], ["Milan", "Milão", 45.46, 9.19, 1832, "studied"], ["Busseto", "Busseto", 44.98, 10.04, 1836, "worked"], ["Milan", "Milão", 45.46, 9.19, 1839, "worked"], ["Genoa", "Gênova", 44.41, 8.93, 1866, "lived"]] },
  "louis-armstrong": { stops: [["Chicago", "Chicago", 41.88, -87.63, 1922, "worked"], ["New York City", "Nova York", 40.71, -74.01, 1924, "worked"], ["Chicago", "Chicago", 41.88, -87.63, 1925, "worked"]] },
  "charles-de-gaulle": { stops: [["Saint-Cyr-l'École", "Saint-Cyr-l'École", 48.8, 2.06, 1910, "studied"], ["Warsaw", "Varsóvia", 52.23, 21.01, 1919, "worked"], ["London", "Londres", 51.51, -0.13, 1940, "worked"], ["Algiers", "Argel", 36.75, 3.06, 1943, "worked"], ["Paris", "Paris", 48.86, 2.35, 1944, "worked"]] },
  pele: { stops: [["Bauru", "Bauru", -22.31, -49.06, 1945, "lived"], ["Santos", "Santos", -23.96, -46.33, 1956, "worked"], ["New York City", "Nova York", 40.71, -74.01, 1975, "worked"]] },
  "diego-maradona": { stops: [["Barcelona", "Barcelona", 41.39, 2.17, 1982, "worked"], ["Naples", "Nápoles", 40.85, 14.27, 1984, "worked"], ["Seville", "Sevilha", 37.39, -5.98, 1992, "worked"], ["Havana", "Havana", 23.11, -82.37, 2000, "lived"], ["Dubai", "Dubai", 25.2, 55.27, 2011, "worked"], ["Culiacán", "Culiacán", 24.8, -107.39, 2018, "worked"]] },
  "bob-marley": { stops: [["Kingston", "Kingston", 17.99, -76.79, 1957, "lived"], ["Wilmington", "Wilmington", 39.74, -75.55, 1966, "worked"], ["Kingston", "Kingston", 17.99, -76.79, 1967, "lived"], ["London", "Londres", 51.51, -0.13, 1977, "lived"]] },
  "bruce-lee": { stops: [["Hong Kong", "Hong Kong", 22.3, 114.17, 1941, "lived"], ["Seattle", "Seattle", 47.61, -122.33, 1959, "studied"], ["Los Angeles", "Los Angeles", 34.05, -118.24, 1966, "worked"]] },
  "audrey-hepburn": { stops: [["Arnhem", "Arnhem", 51.98, 5.91, 1939, "lived"], ["Amsterdam", "Amsterdã", 52.37, 4.9, 1945, "studied"], ["London", "Londres", 51.51, -0.13, 1948, "studied"], ["Rome", "Roma", 41.9, 12.5, 1969, "lived"]] },
  "alfred-hitchcock": { stops: [["Berlin", "Berlim", 52.52, 13.4, 1924, "worked"], ["London", "Londres", 51.51, -0.13, 1926, "worked"], ["Los Angeles", "Los Angeles", 34.05, -118.24, 1939, "worked"]] },
  "alfred-nobel": { stops: [["Saint Petersburg", "São Petersburgo", 59.94, 30.31, 1842, "lived"], ["Paris", "Paris", 48.86, 2.35, 1850, "studied"], ["Stockholm", "Estocolmo", 59.33, 18.07, 1863, "worked"], ["Geesthacht", "Geesthacht", 53.43, 10.37, 1865, "worked"], ["Paris", "Paris", 48.86, 2.35, 1873, "lived"]] },
  "adam-smith": { stops: [["Glasgow", "Glasgow", 55.86, -4.25, 1737, "studied"], ["Oxford", "Oxford", 51.75, -1.26, 1740, "studied"], ["Edinburgh", "Edimburgo", 55.95, -3.19, 1748, "worked"], ["Glasgow", "Glasgow", 55.86, -4.25, 1751, "worked"], ["Toulouse", "Toulouse", 43.6, 1.44, 1764, "lived"], ["Paris", "Paris", 48.86, 2.35, 1766, "lived"]] },
  "antonio-vivaldi": { stops: [["Mantua", "Mântua", 45.16, 10.79, 1718, "worked"], ["Venice", "Veneza", 45.44, 12.33, 1720, "worked"]] },
  "erwin-schrodinger": { stops: [["Zürich", "Zurique", 47.37, 8.55, 1921, "worked"], ["Berlin", "Berlim", 52.52, 13.4, 1927, "worked"], ["Oxford", "Oxford", 51.75, -1.26, 1933, "worked"], ["Graz", "Graz", 47.07, 15.44, 1936, "worked"], ["Dublin", "Dublin", 53.35, -6.26, 1939, "worked"]] },
  "james-cook": { stops: [["London", "Londres", 51.51, -0.13, 1755, "worked"], ["Quebec City", "Cidade de Quebec", 46.81, -71.21, 1759, "worked"], ["St. John's", "St. John's", 47.56, -52.71, 1763, "worked"], ["London", "Londres", 51.51, -0.13, 1768, "lived"]] },
  "lord-byron": { stops: [["Aberdeen", "Aberdeen", 57.15, -2.09, 1789, "lived"], ["Harrow", "Harrow", 51.58, -0.33, 1801, "studied"], ["Cambridge", "Cambridge", 52.2, 0.12, 1805, "studied"], ["Venice", "Veneza", 45.44, 12.33, 1816, "lived"], ["Ravenna", "Ravena", 44.42, 12.2, 1819, "lived"], ["Pisa", "Pisa", 43.72, 10.4, 1821, "lived"], ["Genoa", "Gênova", 44.41, 8.93, 1822, "lived"]] },
  "oscar-wilde": { stops: [["Oxford", "Oxford", 51.75, -1.26, 1874, "studied"], ["London", "Londres", 51.51, -0.13, 1879, "lived"], ["Naples", "Nápoles", 40.85, 14.27, 1897, "lived"]] },
  "claude-monet": { stops: [["Le Havre", "Le Havre", 49.49, 0.11, 1845, "lived"], ["Paris", "Paris", 48.86, 2.35, 1859, "studied"], ["Algiers", "Argel", 36.75, 3.06, 1861, "worked"], ["London", "Londres", 51.51, -0.13, 1870, "lived"], ["Argenteuil", "Argenteuil", 48.95, 2.25, 1871, "lived"], ["Vétheuil", "Vétheuil", 49.06, 1.69, 1878, "lived"]] },
  "henri-matisse": { stops: [["Paris", "Paris", 48.86, 2.35, 1891, "studied"], ["Collioure", "Collioure", 42.53, 3.08, 1905, "worked"], ["Tangier", "Tânger", 35.77, -5.8, 1912, "worked"], ["Nice", "Nice", 43.7, 7.27, 1917, "lived"]] },
  "frank-lloyd-wright": { stops: [["Madison", "Madison", 43.07, -89.4, 1886, "studied"], ["Chicago", "Chicago", 41.88, -87.63, 1887, "worked"], ["Spring Green", "Spring Green", 43.18, -90.07, 1911, "lived"], ["Tokyo", "Tóquio", 35.68, 139.69, 1917, "worked"], ["Scottsdale", "Scottsdale", 33.49, -111.93, 1937, "lived"]] },
  "le-corbusier": { stops: [["Paris", "Paris", 48.86, 2.35, 1908, "worked"], ["Berlin", "Berlim", 52.52, 13.4, 1910, "worked"], ["La Chaux-de-Fonds", "La Chaux-de-Fonds", 47.1, 6.83, 1912, "worked"], ["Paris", "Paris", 48.86, 2.35, 1917, "lived"], ["Chandigarh", "Chandigarh", 30.73, 76.78, 1951, "worked"]] },
  "kwame-nkrumah": { stops: [["Accra", "Acra", 5.6, -0.19, 1927, "studied"], ["Lincoln University", "Lincoln University", 39.81, -75.93, 1935, "studied"], ["London", "Londres", 51.51, -0.13, 1945, "studied"], ["Accra", "Acra", 5.6, -0.19, 1947, "worked"], ["Conakry", "Conacri", 9.64, -13.58, 1966, "lived"]] },
  "indira-gandhi": { stops: [["Santiniketan", "Santiniketan", 23.68, 87.68, 1934, "studied"]] },
  "fidel-castro": {
    // Its school (Wikidata) sits where it moved to later.
    drop: ["Miami"],
    stops: [["Santiago de Cuba", "Santiago de Cuba", 20.02, -75.82, 1941, "studied"], ["Havana", "Havana", 23.11, -82.37, 1945, "studied"], ["Mexico City", "Cidade do México", 19.43, -99.13, 1955, "lived"]] },
  "pope-john-paul-ii": { stops: [["Rome", "Roma", 41.9, 12.5, 1946, "studied"], ["Kraków", "Cracóvia", 50.06, 19.94, 1948, "worked"]] },
  "johannes-brahms": { stops: [["Düsseldorf", "Düsseldorf", 51.23, 6.78, 1853, "lived"], ["Detmold", "Detmold", 51.94, 8.88, 1857, "worked"], ["Hamburg", "Hamburgo", 53.55, 9.99, 1859, "lived"]] },
  "gustav-mahler": { stops: [["Jihlava", "Jihlava", 49.4, 15.59, 1860, "lived"], ["Vienna", "Viena", 48.21, 16.37, 1875, "studied"], ["Kassel", "Kassel", 51.31, 9.48, 1883, "worked"], ["Prague", "Praga", 50.08, 14.42, 1885, "worked"], ["Leipzig", "Leipzig", 51.34, 12.37, 1886, "worked"], ["Budapest", "Budapeste", 47.5, 19.04, 1888, "worked"], ["Hamburg", "Hamburgo", 53.55, 9.99, 1891, "worked"], ["Vienna", "Viena", 48.21, 16.37, 1897, "worked"], ["New York City", "Nova York", 40.71, -74.01, 1908, "worked"]] },
  "franz-kafka": { stops: [["Merano", "Merano", 46.67, 11.16, 1920, "lived"], ["Tatranské Matliare", "Tatranské Matliare", 49.2, 20.27, 1921, "lived"], ["Berlin", "Berlim", 52.52, 13.4, 1923, "lived"]] },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const data = await getJson(SPARQL + encodeURIComponent(query));
  return data.results.bindings;
}

const qidOf = (uri) => uri?.replace("http://www.wikidata.org/entity/", "");
const val = (row, key) => row[key]?.value;
const values = (qids) => qids.map((q) => `wd:${q}`).join(" ");

/** "1905-01-01T00:00:00Z" → 1905; "-0043-…" → -43. */
function yearOf(literal) {
  const m = /^(-?)(\d+)-/.exec(literal ?? "");
  return m ? (m[1] ? -1 : 1) * parseInt(m[2], 10) : null;
}

/** "Point(13.38 52.51)" → { lat, lon }. */
function pointOf(literal) {
  const m = /^Point\(([-\d.eE]+) ([-\d.eE]+)\)$/.exec(literal ?? "");
  return m ? { lat: Math.round(parseFloat(m[2]) * 100) / 100, lon: Math.round(parseFloat(m[1]) * 100) / 100 } : null;
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

/** Every place statement of the people, one entry per statement, with its earliest years. */
async function fetchStatements(qids) {
  const out = [];
  for (const batch of chunks(qids, BATCH)) {
    const rows = await sparql(`
SELECT ?p ?st ?kind ?place ?start ?end ?at WHERE {
  VALUES ?p { ${values(batch)} }
  { ?p p:P551 ?st . ?st ps:P551 ?place . BIND("lived" AS ?kind) }
  UNION { ?p p:P937 ?st . ?st ps:P937 ?place . BIND("worked" AS ?kind) }
  UNION { ?p p:P69 ?st . ?st ps:P69 ?place . BIND("studied" AS ?kind) }
  UNION { ?p p:P108 ?st . ?st ps:P108 ?place . BIND("employer" AS ?kind) }
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?st pq:P585 ?at }
  FILTER(isIRI(?place))
}`);
    const byStatement = new Map();
    for (const row of rows) {
      const id = val(row, "st");
      const kind = val(row, "kind");
      const entry = byStatement.get(id) ?? {
        person: qidOf(val(row, "p")),
        kind: kind === "employer" ? "worked" : kind,
        // Schools and employers are institutions: named by their town.
        institution: kind === "studied" || kind === "employer",
        place: qidOf(val(row, "place")),
        start: null,
        end: null,
        at: null,
      };
      for (const key of ["start", "end", "at"]) {
        const year = yearOf(val(row, key));
        if (year !== null && (entry[key] === null || year < entry[key])) entry[key] = year;
      }
      byStatement.set(id, entry);
    }
    out.push(...byStatement.values());
    await sleep(800);
  }
  return out;
}

/** Labels, coordinates, country, whether it is too big to be a stop, and where it is (P131, P159, P276). */
async function fetchPlaces(qids) {
  const out = new Map(qids.map((id) => [id, { en: null, pt: null, at: null, country: null, big: false, within: [] }]));
  for (const batch of chunks(qids, BATCH)) {
    const own = await sparql(`
SELECT ?place (SAMPLE(?en_) AS ?en) (SAMPLE(?pt_) AS ?pt) (SAMPLE(?coord_) AS ?coord) (SAMPLE(?c_) AS ?country) (MAX(?big_) AS ?big) WHERE {
  VALUES ?place { ${values(batch)} }
  OPTIONAL { ?place rdfs:label ?en_ FILTER(LANG(?en_) = "en") }
  OPTIONAL { ?place rdfs:label ?pt_ FILTER(LANG(?pt_) = "pt") }
  OPTIONAL { ?place wdt:P625 ?coord_ }
  OPTIONAL { ?place wdt:P17 ?k . ?k rdfs:label ?c_ FILTER(LANG(?c_) = "en") }
  BIND(EXISTS { VALUES ?type { ${values(TOO_BIG)} } ?place wdt:P31 ?type } AS ?big_)
} GROUP BY ?place`);
    for (const row of own) {
      const place = out.get(qidOf(val(row, "place")));
      place.en = val(row, "en") ?? null;
      place.pt = val(row, "pt") ?? place.en;
      place.at = pointOf(val(row, "coord"));
      place.country = val(row, "country") ?? null;
      place.big = val(row, "big") === "true";
    }
    await sleep(800);
    const around = await sparql(`
SELECT ?place ?how ?where ?en ?pt ?coord ?country ?big WHERE {
  VALUES ?place { ${values(batch)} }
  hint:Query hint:optimizer "None" .
  { ?place wdt:P131 ?where . BIND(1 AS ?how) } UNION { ?place wdt:P159 ?where . BIND(2 AS ?how) } UNION { ?place wdt:P276 ?where . BIND(3 AS ?how) }
  ?where wdt:P625 ?coord .
  OPTIONAL { ?where rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?where rdfs:label ?pt FILTER(LANG(?pt) = "pt") }
  OPTIONAL { ?where wdt:P17 ?k . ?k rdfs:label ?country FILTER(LANG(?country) = "en") }
  OPTIONAL { VALUES ?type { ${values(TOO_BIG)} } ?where wdt:P31 ?type . BIND(true AS ?big) }
}`);
    for (const row of around) {
      const place = out.get(qidOf(val(row, "place")));
      const id = qidOf(val(row, "where"));
      if (place.within.some((w) => w.id === id)) continue;
      place.within.push({
        id,
        how: Number(val(row, "how")),
        en: val(row, "en") ?? null,
        pt: val(row, "pt") ?? val(row, "en") ?? null,
        at: pointOf(val(row, "coord")),
        country: val(row, "country") ?? null,
        big: val(row, "big") === "true",
      });
    }
    for (const place of out.values()) place.within.sort((a, b) => a.how - b.how);
    await sleep(800);
  }
  return out;
}

const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const SMALL = new Set(["the", "of", "and", "de", "da", "do", "das", "dos", "la", "le", "el", "von", "van", "der", "del", "di", "du", "saint", "san", "santa", "sao", "great", "grande", "jr", "princess", "princesa"]);

/** The words of a person's name a place could carry: "Simón Bolívar" → simon, bolivar. */
function nameWords(person) {
  const words = [person.name.en, person.name.pt]
    .flatMap((name) => name.split(/[\s,.'’()-]+/))
    .map(fold)
    .filter((word) => word.length >= 4 && !SMALL.has(word));
  return [...new Set(words)];
}

const carriesName = (text, words) => words.some((word) => new RegExp(`(?<![\\p{L}])${word}`, "u").test(fold(text)));

// Buildings, estates and districts are named by their town, like institutions.
const BUILDING =
  /\b(house|hotel|castle|château|chateau|palace|estate|manor|villa|farm|street|calle|place|square|tower|church|abbey|monastery|cathedral|studios?|school|college|university|institute|academy|laboratory|society|foundation|museum|library|hospital|gymnasium|lyceum|conservatory|seminary|district|arrondissement|borough|municipality|county|governorate|parish|quarter|terrace)\b/i;

const cities = JSON.parse(await readFile(CITIES, "utf8"));
const countryNames = new Set(JSON.parse(await readFile(COUNTRIES, "utf8")).flatMap((c) => [c.name.en, c.name.pt]));

// What an administrative area is called around its town: "Lund Municipality", "City of Edinburgh", "London Borough of Harrow".
const townName = (label) =>
  label
    .replace(/^(London Borough of|Royal Borough of|Borough of|City of|Municipality of|Comune di|Canton of|comuna da|comuna de)\s+/i, "")
    .replace(/\s+(Municipality|Municipal District|Borough|District|kommun|Kommune|Township|Center)$/i, "")
    .replace(/^(Aberdeen|Dundee|Glasgow|Edinburgh) City$/, "$1")
    .replace(/^(Município de|Concelho de|Cidade de)\s+/i, "");

/** Too wide an area to name a town by: a county, a state, a province. */
const REGION = /(shire|County|Province|Region|State|Oblast|Krai|Prefecture|Department|Canton|District|Island|Governorate|Voivodeship|Nadu|Pradesh)$/i;

/** How close (km) a place must be to a big city to go by its name. */
const snapKm = (pop) => (pop >= 5e6 ? 12 : pop >= 1e6 ? 7 : pop >= 3e5 ? 4 : 2.5);

/** The big city a point is in, if any: the biggest whose reach covers it. */
function cityAt(point) {
  let found = null;
  for (const city of cities) {
    if (distanceKm(point, city) <= snapKm(city.pop) && (!found || city.pop > found.pop)) found = city;
  }
  return found;
}

/** A stop's name: the big city it is in, else its own name, else (for an institution or a building) its town's. */
function nameStop(place, institution) {
  // An employer without coordinates of its own is put nowhere: its headquarters are today's, not theirs.
  const at = place.at ?? (institution ? null : (place.within.find((w) => w.at)?.at ?? null));
  if (!at || !place.en) return null;
  const city = cityAt(at);
  if (city) return { name: city.name, at, country: place.country };
  const building = institution || BUILDING.test(place.en);
  if (building) {
    const near = place.within.filter((w) => w.en && w.at && distanceKm(w.at, at) < 60);
    const town = near.find((w) => !w.big && !REGION.test(w.en) && !REGION.test(townName(w.en)) && !/^Canton of/i.test(w.en));
    if (town) {
      const name = { en: townName(town.en), pt: townName(town.pt ?? town.en) };
      return { name, at, country: place.country ?? town.country };
    }
    // "Government Arts College, Kumbakonam": the town after the comma.
    const after = /,\s*([^,]+)$/.exec(place.en)?.[1];
    if (after && !BUILDING.test(after)) return { name: { en: after, pt: after }, at, country: place.country };
    // Else a big city nearby, or nothing: a stop is named by a town, never by an institution alone.
    const nearby = cities
      .map((c) => ({ c, km: distanceKm(at, c) }))
      .filter(({ km }) => km <= 30)
      .sort((a, b) => a.km - b.km)[0]?.c;
    return nearby ? { name: nearby.name, at, country: place.country } : null;
  }
  return { name: { en: place.en, pt: place.pt ?? place.en }, at, country: place.country ?? place.within[0]?.country ?? null };
}

// Wikidata's Portuguese labels are often the European ones; the game speaks Brazilian Portuguese.
const PT_BR = {
  "Nova Iorque": "Nova York",
  Génova: "Gênova",
  Moscovo: "Moscou",
  Amesterdão: "Amsterdã",
  Estugarda: "Stuttgart",
  Teerão: "Teerã",
  "Cidade de Quebec": "Quebec",
  Madrid: "Madri",
  Bronx: "Bronx",
};

/** "Klin (Moscow Oblast)" → "Klin"; "Svalöv Municipality" → "Svalöv". */
const tidy = (name) => {
  const clean = (text) => townName(text.replace(/\s*\([^)]*\)\s*$/, "").trim());
  const pt = clean(name.pt ?? name.en);
  return { en: clean(name.en), pt: PT_BR[pt] ?? pt };
};

/** Born and died places come named from the notables; a big city's district goes by the city. */
function namePlace(place) {
  const city = cityAt(place);
  return city && city.name.en !== place.name.en && distanceKm(city, place) <= Math.min(snapKm(city.pop), 8) ? city.name : place.name;
}

/** Merges stops closer than MERGE_KM to the one before; a death in the same city takes the stop's place. */
function mergeClose(stops) {
  const out = [];
  for (const stop of stops) {
    const last = out.at(-1);
    if (last && distanceKm(last, stop) < MERGE_KM) {
      if (stop.kind === "died" && last.kind !== "born") out[out.length - 1] = stop;
      continue;
    }
    out.push(stop);
  }
  return out;
}

/** Keeps the first and last stops and an even spread of the middle ones. */
function thin(stops) {
  if (stops.length <= MAX_STOPS) return stops;
  const middle = stops.slice(1, -1);
  const keep = MAX_STOPS - 2;
  const picked = Array.from({ length: keep }, (_, i) => middle[Math.round((i * (middle.length - 1)) / (keep - 1))]);
  return [stops[0], ...picked, stops.at(-1)];
}

const notables = JSON.parse(await readFile(NOTABLES, "utf8"));
const byQid = new Map(notables.map((person) => [person.qid, person]));

console.log(`${notables.length} notables: fetching places of their lives…`);
const statements = await fetchStatements(notables.map((person) => person.qid));
console.log(`${statements.length} place statements`);
const places = await fetchPlaces([...new Set(statements.map((s) => s.place))]);
if (process.env.DUMP_PLACES) await writeFile(process.env.DUMP_PLACES, JSON.stringify([...places], null, 1));
console.log(`${places.size} places`);

const tracks = [];
const reasons = { fewStops: 0, oneCountry: 0 };
for (const person of notables) {
  const words = nameWords(person);
  const extra = OVERRIDES[person.id] ?? {};
  const middle = [];
  for (const s of statements.filter((st) => byQid.get(st.person) === person)) {
    const place = places.get(s.place);
    if (!place || place.big || countryNames.has(place.en)) continue;
    const year = s.start ?? s.at ?? s.end;
    if (year === null || year < person.born.year || year > person.died.year) continue;
    const named = nameStop(place, s.institution);
    if (!named || extra.drop?.includes(named.name.en)) continue;
    const institution = named.name.en !== place.en ? { en: place.en, pt: place.pt ?? place.en } : undefined;
    middle.push({ name: named.name, lat: named.at.lat, lon: named.at.lon, year, kind: s.kind, at: institution, country: named.country });
  }
  for (const [en, pt, lat, lon, year, kind] of extra.stops ?? []) {
    middle.push({ name: { en, pt }, lat, lon, year, kind, country: null });
  }
  // Same year: studies before a home before work.
  const ORDER = { studied: 0, lived: 1, worked: 2 };
  middle.sort((a, b) => a.year - b.year || ORDER[a.kind] - ORDER[b.kind]);

  const born = person.born.place;
  const died = extra.died
    ? { name: { en: extra.died[0], pt: extra.died[1] }, lat: extra.died[2], lon: extra.died[3], country: null }
    : person.died.place && !countryNames.has(person.died.place.name.en)
      ? person.died.place
      : null;
  const route = [
    { name: namePlace(born), lat: born.lat, lon: born.lon, year: person.born.year, kind: "born", country: born.country?.en ?? null },
    ...middle,
    ...(died
      ? [{ name: namePlace(died), lat: died.lat, lon: died.lon, year: person.died.year, kind: "died", country: died.country?.en ?? null }]
      : []),
  ].filter((stop) => ![stop.name.en, stop.name.pt, stop.at?.en, stop.at?.pt].some((text) => text && carriesName(text, words)));

  const stops = mergeClose(thin(mergeClose(route))).map((stop) => ({ ...stop, name: tidy(stop.name) }));
  if (stops.length < MIN_STOPS) {
    reasons.fewStops++;
    if (person.fame >= 120 && process.env.SHOW_MISSES) console.log(`  ${person.id} (${person.fame}): ${stops.map((stop) => `${stop.year} ${stop.name.en}`).join(" > ")}`);
    continue;
  }
  // A route needs some distance in it: two countries, 250 km across at the widest, or many stops.
  const countries = new Set(stops.map((stop) => stop.country).filter(Boolean));
  const spread = Math.max(...stops.flatMap((a) => stops.map((b) => distanceKm(a, b))));
  if (countries.size < 2 && spread < 250 && stops.length < 6) {
    reasons.oneCountry++;
    continue;
  }
  tracks.push({
    id: person.id,
    stops: stops.map(({ name, lat, lon, year, kind, at }) => ({ name, lat, lon, year, kind, ...(at ? { at } : {}) })),
  });
}

tracks.sort((a, b) => a.id.localeCompare(b.id));
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, JSON.stringify(tracks));
const stopCount = tracks.reduce((sum, track) => sum + track.stops.length, 0);
console.log(
  `${tracks.length} tracks (${stopCount} stops) → ${path.relative(ROOT, OUT)}; ` +
    `left out: ${reasons.fewStops} with < ${MIN_STOPS} stops, ${reasons.oneCountry} that stayed in one place`,
);
