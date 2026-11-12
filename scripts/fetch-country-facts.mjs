// Builds lib/data/country-facts.json — population, wealth, life expectancy
// and more for every country the site plays with — for Higher or Lower.
//
// Source: World Bank Open Data (CC BY 4.0), https://data.worldbank.org —
// the most recent value of each indicator for each country. The credit is
// kept in the file and shown in the game.
//
//   npm run data:facts
//
// Needs the network. World Bank aggregates (regions, income groups) are
// dropped: only the countries of lib/data/countries.json are kept.

import { readFileSync, writeFileSync } from "node:fs";

const COUNTRIES = "lib/data/countries.json";
const TARGET = "lib/data/country-facts.json";
const USER_AGENT = "who-when-where-data-script/1.0";

const INDICATORS = {
  population: { code: "SP.POP.TOTL", digits: 0 },
  gdpPerCapita: { code: "NY.GDP.PCAP.CD", digits: 0 },
  lifeExpectancy: { code: "SP.DYN.LE00.IN", digits: 1 },
  urban: { code: "SP.URB.TOTL.IN.ZS", digits: 1 },
  forest: { code: "AG.LND.FRST.ZS", digits: 1 },
};

const countries = JSON.parse(readFileSync(COUNTRIES, "utf8")).map((country) => country.id);
const known = new Set(countries);

async function fetchIndicator(code) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=20000&mrnev=1`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${code}: HTTP ${response.status}`);
  const [, rows] = await response.json();
  return rows ?? [];
}

const facts = Object.fromEntries(countries.map((id) => [id, {}]));
const years = Object.fromEntries(countries.map((id) => [id, []]));
const coverage = {};

for (const [field, { code, digits }] of Object.entries(INDICATORS)) {
  const rows = await fetchIndicator(code);
  let count = 0;
  for (const row of rows) {
    const id = row.country?.id?.toLowerCase();
    if (!known.has(id) || row.value === null || row.value === undefined) continue;
    const scale = 10 ** digits;
    facts[id][field] = Math.round(row.value * scale) / scale;
    years[id].push(Number(row.date));
    count++;
  }
  coverage[field] = `${count}/${countries.length}`;
}

for (const id of countries) {
  const list = years[id];
  if (!list.length) {
    delete facts[id];
    continue;
  }
  const tally = new Map();
  for (const year of list) tally.set(year, (tally.get(year) ?? 0) + 1);
  facts[id].year = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

writeFileSync(
  TARGET,
  `${JSON.stringify({ source: "World Bank Open Data", licence: "CC BY 4.0", url: "https://data.worldbank.org", facts })}\n`,
);

console.log(`Facts for ${Object.keys(facts).length} of ${countries.length} countries written to ${TARGET}`);
console.log("Coverage:", coverage);
const none = countries.filter((id) => !facts[id]);
if (none.length) console.log(`No facts at all for: ${none.join(", ")}`);
