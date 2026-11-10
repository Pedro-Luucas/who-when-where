// Builds lib/data/countries.json — the countries Overland and Outline are
// played with — from the world map the site already ships
// (public/geo/countries-50m.json): who borders whom, where each country sits,
// how big it is, and its name in both languages.
//
//   npm run data:countries
//
// Names come from the runtime's own CLDR data (Intl.DisplayNames), so the
// script needs no network. Fix a name or a border in the tables below.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { geoArea, geoBounds, geoCentroid } from "d3-geo";
import { feature, neighbors } from "topojson-client";

const SOURCE = "public/geo/countries-50m.json";
const TARGET = "lib/data/countries.json";

// ISO 3166-1 alpha-2 codes for the shapes whose map name is abbreviated or
// differs from CLDR's English name.
const CODES = {
  "Antigua and Barb.": "AG",
  Benin: "BJ",
  "Bosnia and Herz.": "BA",
  "Burkina Faso": "BF",
  "Cabo Verde": "CV",
  "Central African Rep.": "CF",
  Congo: "CG",
  "Côte d'Ivoire": "CI",
  "Dem. Rep. Congo": "CD",
  "Dominican Rep.": "DO",
  "Eq. Guinea": "GQ",
  France: "FR",
  Kosovo: "XK",
  Macedonia: "MK",
  "Marshall Is.": "MH",
  Myanmar: "MM",
  Palestine: "PS",
  Russia: "RU",
  "S. Sudan": "SS",
  "Saint Lucia": "LC",
  Serbia: "RS",
  "Solomon Is.": "SB",
  "St. Kitts and Nevis": "KN",
  "St. Vin. and Gren.": "VC",
  "São Tomé and Principe": "ST",
  "Timor-Leste": "TL",
  "Trinidad and Tobago": "TT",
  Turkey: "TR",
  "United Kingdom": "GB",
  "United States of America": "US",
  Vatican: "VA",
  "W. Sahara": "EH",
  eSwatini: "SZ",
};

// Shapes drawn on the map that are not played as countries of their own.
const LEFT_OUT = new Set([
  "American Samoa",
  "Anguilla",
  "Antarctica",
  "Aruba",
  "Ashmore and Cartier Is.",
  "Bermuda",
  "Br. Indian Ocean Ter.",
  "British Virgin Is.",
  "Cayman Is.",
  "Cook Is.",
  "Curaçao",
  "Faeroe Is.",
  "Falkland Is.",
  "Fr. Polynesia",
  "Fr. S. Antarctic Lands",
  "Guam",
  "Guernsey",
  "Heard I. and McDonald Is.",
  "Indian Ocean Ter.",
  "Isle of Man",
  "Jersey",
  "Montserrat",
  "N. Mariana Is.",
  "New Caledonia",
  "Niue",
  "Norfolk Island",
  "Pitcairn Is.",
  "Puerto Rico",
  "S. Geo. and the Is.",
  "Saint Helena",
  "Siachen Glacier",
  "Sint Maarten",
  "St-Barthélemy",
  "St-Martin",
  "St. Pierre and Miquelon",
  "Turks and Caicos Is.",
  "U.S. Virgin Is.",
  "Wallis and Futuna Is.",
]);

// Shapes that are coloured in with another country.
const PART_OF = {
  Somaliland: "Somalia",
  "N. Cyprus": "Cyprus",
  "Hong Kong": "China",
  Macao: "China",
  Åland: "Finland",
};

// Borders the map draws that a traveller would not call one: French Guiana
// is part of France's shape, an ocean away from the rest of it.
const NO_BORDER = [
  ["FR", "BR"],
  ["FR", "SR"],
];

// Names to use instead of CLDR's.
const NAMES = {
  BA: { en: "Bosnia and Herzegovina" },
  CD: { en: "DR Congo", pt: "República Democrática do Congo" },
  CG: { en: "Republic of the Congo", pt: "República do Congo" },
  CI: { en: "Ivory Coast" },
  CZ: { en: "Czechia", pt: "Tchéquia" },
  MM: { en: "Myanmar", pt: "Mianmar" },
  PS: { en: "Palestine", pt: "Palestina" },
  TR: { en: "Turkey", pt: "Turquia" },
  VA: { en: "Vatican City", pt: "Vaticano" },
  AG: { en: "Antigua and Barbuda" },
  KN: { en: "Saint Kitts and Nevis" },
  LC: { en: "Saint Lucia" },
  VC: { en: "Saint Vincent and the Grenadines" },
  ST: { en: "São Tomé and Príncipe" },
  TT: { en: "Trinidad and Tobago" },
};

// Other names a player may type.
const ALSO = {
  US: ["USA", "United States of America", "America", "EUA", "Estados Unidos da América"],
  GB: ["UK", "Great Britain", "Britain", "England", "Grã-Bretanha", "Inglaterra"],
  NL: ["Holland", "Holanda"],
  MM: ["Burma", "Birmânia"],
  CI: ["Côte d'Ivoire"],
  CD: ["Democratic Republic of the Congo", "Congo-Kinshasa", "RDC", "DRC"],
  CG: ["Congo", "Congo-Brazzaville"],
  CZ: ["Czech Republic", "República Tcheca"],
  SZ: ["Swaziland", "Suazilândia"],
  MK: ["Macedonia", "Macedônia"],
  TL: ["East Timor", "Timor Leste"],
  TR: ["Türkiye"],
  CV: ["Cabo Verde"],
  KR: ["Korea", "Coreia"],
  KP: ["DPRK"],
  AE: ["UAE", "Emirates", "Emirados"],
  RU: ["Russian Federation"],
  VA: ["Holy See", "Santa Sé"],
  BY: ["Belarus", "Bielorrússia"],
  IR: ["Persia", "Pérsia"],
};

const KM2 = 6371 ** 2;
const topology = JSON.parse(readFileSync(SOURCE, "utf8"));
const geometries = topology.objects.countries.geometries;
const english = new Intl.DisplayNames(["en"], { type: "region" });
const portuguese = new Intl.DisplayNames(["pt-BR"], { type: "region" });

// Every code by its English name. CLDR still answers to withdrawn codes
// ("DD", "SU", "YU"…); Intl.Locale turns each into the one that replaced it.
const codeByName = new Map();
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
for (const a of LETTERS) {
  for (const b of LETTERS) {
    const name = english.of(a + b);
    if (!name || name === a + b) continue;
    const code = new Intl.Locale(`und-${a + b}`).region;
    if (english.of(code) === name) codeByName.set(name, code);
  }
}

const codeOf = (name) => CODES[name] ?? codeByName.get(name);
const shapeNames = geometries.map((geometry) => geometry.properties.name);

// The country each shape counts as, or null when it is left out.
const owner = shapeNames.map((name) => {
  if (LEFT_OUT.has(name)) return null;
  const code = codeOf(PART_OF[name] ?? name);
  if (!code) throw new Error(`No country code for "${name}": add it to CODES or LEFT_OUT.`);
  return code;
});

/** The largest polygon of a shape: the country's mainland. */
function mainland(index) {
  const shape = feature(topology, geometries[index]);
  const polygons =
    shape.geometry.type === "Polygon" ? [shape.geometry.coordinates] : shape.geometry.coordinates;
  return polygons
    .map((coordinates) => ({ type: "Polygon", coordinates }))
    .reduce((largest, polygon) => (geoArea(polygon) > geoArea(largest) ? polygon : largest));
}

const touching = neighbors(geometries);
const countries = new Map();

shapeNames.forEach((name, index) => {
  const code = owner[index];
  if (!code || PART_OF[name]) return;
  const main = mainland(index);
  const [lon, lat] = geoCentroid(main);
  const [[west, south], [east, north]] = geoBounds(main);
  countries.set(code, {
    id: code.toLowerCase(),
    name: {
      en: NAMES[code]?.en ?? english.of(code),
      pt: NAMES[code]?.pt ?? portuguese.of(code),
    },
    ...(ALSO[code] && { also: ALSO[code] }),
    shapes: [name],
    lat: +lat.toFixed(2),
    lon: +lon.toFixed(2),
    box: [west, south, east, north].map((value) => +value.toFixed(1)),
    area: 0,
    borders: new Set(),
  });
});

const barred = new Set(NO_BORDER.flatMap(([a, b]) => [`${a}:${b}`, `${b}:${a}`]));

shapeNames.forEach((name, index) => {
  const code = owner[index];
  if (!code) return;
  const country = countries.get(code);
  if (PART_OF[name]) country.shapes.push(name);
  country.area += geoArea(feature(topology, geometries[index])) * KM2;
  for (const other of touching[index]) {
    const neighbour = owner[other];
    if (neighbour && neighbour !== code && !barred.has(`${code}:${neighbour}`)) {
      country.borders.add(neighbour.toLowerCase());
    }
  }
});

const list = [...countries.values()]
  .map((country) => ({
    ...country,
    area: Math.round(country.area),
    borders: [...country.borders].sort(),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

// A border has two sides.
for (const country of list) {
  for (const id of country.borders) {
    const other = list.find((entry) => entry.id === id);
    if (!other.borders.includes(country.id)) throw new Error(`${country.id}–${id} is one-sided`);
  }
}

mkdirSync("lib/data", { recursive: true });
writeFileSync(TARGET, JSON.stringify(list, null, 1) + "\n");

const bordered = list.filter((country) => country.borders.length > 0);
console.log(`${list.length} countries (${bordered.length} with a land border) → ${TARGET}`);
if (process.argv.includes("--list")) {
  for (const country of list) {
    console.log(`${country.id}  ${country.name.en} · ${country.name.pt}  [${country.borders.join(" ")}]`);
  }
}
