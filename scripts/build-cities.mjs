// Builds lib/data/cities.json — the cities Pin the City is played with.
//
// Source: Natural Earth populated places (public domain),
// https://www.naturalearthdata.com. Download ne_10m_populated_places.geojson
// (e.g. from github.com/nvkelso/natural-earth-vector) and pass its path:
//
//   npm run data:cities -- <path-to-populated-places-geojson>
//
// Kept: every national capital, every city of a million people or more, and
// the cities of Brazil and Portugal from 250,000 (so those sets have enough to
// play). Only cities in a country of lib/data/countries.json are kept.

import { readFileSync, writeFileSync } from "node:fs";

const COUNTRIES = "lib/data/countries.json";
const REGIONS = "lib/data/regions.json";
const TARGET = "lib/data/cities.json";

const BIG = 1_000_000;
const HOME = new Set(["br", "pt"]);
const HOME_MIN = 250_000;

// Natural Earth's Portuguese names are mostly European Portuguese; the site
// speaks Brazilian Portuguese. Corrections by the English name (and one
// misnamed city).
const NAMES = {
  "New York City": { pt: "Nova York" },
  Moscow: { pt: "Moscou" },
  Tehran: { pt: "Teerã" },
  Bangkok: { pt: "Bangkok" },
  Baghdad: { pt: "Bagdá" },
  Riyadh: { pt: "Riad" },
  Amsterdam: { pt: "Amsterdã" },
  Rotterdam: { pt: "Roterdã" },
  Copenhagen: { pt: "Copenhague" },
  Helsinki: { pt: "Helsinque" },
  Cologne: { pt: "Colônia" },
  Monaco: { pt: "Mônaco" },
  Stuttgart: { pt: "Stuttgart" },
  Mumbai: { pt: "Mumbai" },
  Delhi: { pt: "Délhi" },
  "New Delhi": { pt: "Nova Délhi" },
  Howrah: { pt: "Howrah" },
  Surat: { pt: "Surat" },
  "New Taipei": { pt: "Nova Taipé" },
  Fuzhou: { pt: "Fuzhou" },
  Suzhou: { pt: "Suzhou" },
  Zaozhuang: { pt: "Zaozhuang" },
  Maoming: { pt: "Maoming" },
  Palembang: { pt: "Palembang" },
  Makassar: { pt: "Makassar" },
  Tashkent: { pt: "Tashkent" },
  Tbilisi: { pt: "Tbilisi" },
  Bishkek: { pt: "Bishkek" },
  Melekeok: { pt: "Melekeok" },
  Mbabane: { pt: "Mbabane" },
  "Andorra la Vella": { pt: "Andorra la Vella" },
  Kazan: { pt: "Kazan" },
  "Cagayan de Oro": { pt: "Cagayan de Oro" },
  "Port Elizabeth": { pt: "Port Elizabeth" },
  "Nur-Sultan": { en: "Astana", pt: "Astana" },
  Allahabad: { pt: "Allahabad" },
  Cali: { pt: "Cali" },
  Thimphu: { pt: "Timbu" },
  "Saidu Sharif": { pt: "Saidu Sharif" },
  Kochi: { pt: "Kochi" },
  Visakhapatnam: { pt: "Visakhapatnam" },
  Solapur: { pt: "Solapur" },
  Chattogram: { pt: "Chittagong" },
};

// Countries Natural Earth codes as -99, by their ADM0_A3 code.
const A3 = { KOS: "xk", PSX: "ps", SOL: "so", CYN: "cy", SAH: "eh" };

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/build-cities.mjs <path-to-populated-places-geojson>");
  process.exit(1);
}

const countries = new Set(JSON.parse(readFileSync(COUNTRIES, "utf8")).map((country) => country.id));
const places = JSON.parse(readFileSync(source, "utf8"));

const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const round = (value) => Math.round(value * 100) / 100;

const byId = new Map();
const standIns = [];
for (const { properties: p, geometry } of places.features) {
  const iso = typeof p.ISO_A2 === "string" && /^[A-Z]{2}$/.test(p.ISO_A2) ? p.ISO_A2.toLowerCase() : "";
  const country = iso || A3[p.ADM0_A3] || "";
  if (!countries.has(country)) continue;
  const pop = Number(p.POP_MAX) || 0;
  const capital = p.FEATURECLA === "Admin-0 capital";
  // The seat of a territory that has no Admin-0 capital of its own (Greenland, Palestine): kept as a stand-in.
  if (p.FEATURECLA === "Admin-0 region capital") standIns.push({ p, geometry, country, pop });
  if (!capital && pop < BIG && !(HOME.has(country) && pop >= HOME_MIN)) continue;
  add(p, geometry, country, pop, capital);
}

for (const { p, geometry, country, pop } of standIns) {
  if (![...byId.values()].some((city) => city.country === country && city.capital)) add(p, geometry, country, pop, true);
}

function add(p, geometry, country, pop, capital) {
  const fixed = NAMES[p.NAME_EN || p.NAME] ?? {};
  const en = fixed.en ?? (p.NAME_EN || p.NAME);
  const pt = fixed.pt ?? (p.NAME_PT || en);
  const id = `${slug(en)}-${country}`;
  const previous = byId.get(id);
  // The same city twice (a capital listed apart from its metro): keep the bigger, and its capital status.
  if (previous && previous.pop >= pop) {
    previous.capital ||= capital;
    return;
  }
  const [lon, lat] = geometry?.coordinates ?? [p.LONGITUDE, p.LATITUDE];
  byId.set(id, {
    id,
    name: { en, pt },
    country,
    lat: round(lat),
    lon: round(lon),
    pop,
    capital: capital || (previous?.capital ?? false),
  });
}

const cities = [...byId.values()].sort((a, b) => b.pop - a.pop || a.id.localeCompare(b.id));
writeFileSync(TARGET, `${JSON.stringify(cities)}\n`);

let regions = {};
try {
  regions = JSON.parse(readFileSync(REGIONS, "utf8"));
} catch {
  // Counts per region are only a report.
}
const counts = {};
for (const city of cities) {
  const region = regions[city.country] ?? "?";
  counts[region] = (counts[region] ?? 0) + 1;
}
console.log(`${cities.length} cities written to ${TARGET}`);
console.log("By region:", counts);
console.log(`Brazil: ${cities.filter((city) => city.country === "br").length}, Portugal: ${cities.filter((city) => city.country === "pt").length}`);
const capitals = new Set(cities.filter((city) => city.capital).map((city) => city.country));
const without = [...countries].filter((id) => !capitals.has(id));
if (without.length) console.log(`No capital for: ${without.join(", ")}`);
