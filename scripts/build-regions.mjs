// Builds lib/data/regions.json — the continent of every country the site
// plays with — for the region sets of Pin the City, Click the Country and the
// other map games.
//
// Source: Natural Earth admin 0 countries (public domain),
// https://www.naturalearthdata.com — its CONTINENT field, matched by ISO code.
// Download the GeoJSON (e.g. ne_50m_admin_0_countries.geojson from
// github.com/nvkelso/natural-earth-vector) and pass its path:
//
//   npm run data:regions -- <path-to-admin0-geojson>
//
// Natural Earth puts Central America and the Caribbean in "North America",
// which is what we want. Fix a country's region in OVERRIDES below.

import { readFileSync, writeFileSync } from "node:fs";

const COUNTRIES = "lib/data/countries.json";
const TARGET = "lib/data/regions.json";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/build-regions.mjs <path-to-admin0-geojson>");
  process.exit(1);
}

const CONTINENTS = {
  Africa: "africa",
  Asia: "asia",
  Europe: "europe",
  "North America": "north-america",
  "South America": "south-america",
  Oceania: "oceania",
};

// Countries whose continent is a choice, or that Natural Earth files elsewhere
// ("Seven seas (open ocean)" for small island states).
const OVERRIDES = {
  ru: "europe",
  tr: "asia",
  cy: "europe",
  ge: "asia",
  am: "asia",
  az: "asia",
  kz: "asia",
  eg: "africa",
  pa: "north-america",
  tt: "north-america",
  mv: "asia",
  mu: "africa",
  sc: "africa",
  km: "africa",
  cv: "africa",
  st: "africa",
  mh: "oceania",
  fm: "oceania",
  pw: "oceania",
  ki: "oceania",
  nr: "oceania",
  tv: "oceania",
  to: "oceania",
  ws: "oceania",
  vu: "oceania",
  sb: "oceania",
  xk: "europe",
  ps: "asia",
  eh: "africa",
  tw: "asia",
  sg: "asia",
  bh: "asia",
};

const codeOf = (properties) => {
  for (const field of ["ISO_A2", "ISO_A2_EH", "WB_A2"]) {
    const code = properties[field];
    if (typeof code === "string" && /^[A-Z]{2}$/.test(code)) return code.toLowerCase();
  }
  return null;
};

const countries = JSON.parse(readFileSync(COUNTRIES, "utf8"));
const world = JSON.parse(readFileSync(source, "utf8"));

const found = new Map();
for (const { properties } of world.features) {
  const code = codeOf(properties);
  const region = CONTINENTS[properties.CONTINENT];
  if (code && region && !found.has(code)) found.set(code, region);
}

const regions = {};
const missing = [];
for (const { id } of countries) {
  const region = OVERRIDES[id] ?? found.get(id);
  if (region) regions[id] = region;
  else missing.push(id);
}

writeFileSync(TARGET, `${JSON.stringify(regions, null, 1)}\n`);

const counts = {};
for (const region of Object.values(regions)) counts[region] = (counts[region] ?? 0) + 1;
console.log(`${Object.keys(regions).length} of ${countries.length} countries placed:`, counts);
if (missing.length) {
  console.error(`No region for: ${missing.join(", ")} — add them to OVERRIDES.`);
  process.exit(1);
}
