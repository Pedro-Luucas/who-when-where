// Builds games/rivers-and-ranges/data/features.json — the rivers and mountain
// ranges of Rivers & Ranges: each one's line (or outline) on the map, its
// names, and the countries it passes through.
//
//   node scripts/build-rivers.mjs
//
// Sources (downloads are cached in scripts/.cache):
//   Natural Earth (public domain), github.com/nvkelso/natural-earth-vector:
//     ne_10m_rivers_lake_centerlines   — the rivers, merged by name below
//     ne_10m_geography_regions_polys   — the ranges ("Range/mtn" polygons)
//   Wikidata (CC0): each feature's P205 (basin country) and P17 (country), for
//     `basin`: countries that count as close (no strike) without being on the
//     course itself (the Nile's basin reaches Tanzania; its course doesn't).
//
// The countries crossed are worked out on the world map's own shapes
// (public/geo/countries-50m.json): points every few kilometres along a river,
// or a grid inside a range's outline, each placed in a country. A country
// with only a graze of the feature is dropped; ADD and DROP below fix what
// the coarse shapes get wrong (the Danube touches Moldova for less than a
// kilometre). Names are curated here, English and Brazilian Portuguese.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { geoBounds, geoContains, geoDistance } from "d3-geo";
import { feature } from "topojson-client";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const CACHE = path.join(ROOT, "scripts/.cache/natural-earth");
const WIKIDATA_CACHE = path.join(ROOT, "scripts/.cache/rivers-wikidata.json");
const TARGET = path.join(ROOT, "games/rivers-and-ranges/data/features.json");
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const USER_AGENT = "rivers-build-script/1.0 (data pipeline)";

// ── The roster ──────────────────────────────────────────────────────────────
// [id, English, Portuguese, other names, Natural Earth names, English Wikipedia title, length km (null: no agreed figure)]

const RIVERS = [
  // Africa
  ["nile", "Nile", "Nilo", ["Nile River", "Rio Nilo"], ["Nile", "Victoria Nile", "Albert Nile", "Bahr el Jebel", "El Bahr el Abyad", "Abay", "El Bahr el Azraq"], "Nile", 6650],
  ["congo", "Congo", "Congo", ["Congo River", "Zaire", "Zaïre", "Rio Congo", "Lualaba"], ["Congo", "Lualaba"], "Congo River", 4700],
  ["niger", "Niger", "Níger", ["Niger River", "Rio Níger", "Joliba"], ["Niger"], "Niger River", 4180],
  ["zambezi", "Zambezi", "Zambeze", ["Zambesi", "Zambezi River", "Rio Zambeze"], ["Zambezi"], "Zambezi", 2574],
  ["orange", "Orange", "Orange", ["Orange River", "Gariep", "Rio Orange", "Rio Laranja"], ["Orange"], "Orange River", 2200],
  ["limpopo", "Limpopo", "Limpopo", ["Limpopo River", "Rio Limpopo"], ["Limpopo"], "Limpopo River", 1750],
  ["senegal", "Senegal", "Senegal", ["Senegal River", "Sénégal", "Rio Senegal"], ["Sénégal"], "Senegal River", 1086],
  ["okavango", "Okavango", "Okavango", ["Cubango", "Okavango River", "Rio Okavango"], ["Okavango", "Cubango"], "Okavango River", 1600],
  // Europe
  ["danube", "Danube", "Danúbio", ["Donau", "Dunărea", "Duna", "Dunav", "Rio Danúbio"], ["Danube", "Donau"], "Danube", 2850],
  ["rhine", "Rhine", "Reno", ["Rhein", "Rhin", "Rijn", "Rio Reno"], ["Rhine", "Rhein", "Rhin"], "Rhine", 1233],
  ["volga", "Volga", "Volga", ["Volga River", "Rio Volga"], ["Volga"], "Volga", 3530],
  ["elbe", "Elbe", "Elba", ["Labe", "Rio Elba"], ["Elbe"], "Elbe", 1094],
  ["dnieper", "Dnieper", "Dniepre", ["Dnipro", "Dnepr", "Dnieper River", "Rio Dniepre", "Dnieper"], ["Dnipro", "Dnepre"], "Dnieper", 2201],
  ["dniester", "Dniester", "Dniestre", ["Dnister", "Nistru", "Rio Dniestre"], ["Dniester"], "Dniester", 1362],
  ["loire", "Loire", "Loire", ["Loire River", "Rio Loire", "Líger"], ["Loire"], "Loire", 1006],
  ["rhone", "Rhône", "Ródano", ["Rhone", "Rhodanus", "Rio Ródano"], ["Rhône", "Rhne"], "Rhône", 813],
  ["seine", "Seine", "Sena", ["Rio Sena"], ["Seine"], "Seine", 777],
  ["po", "Po", "Pó", ["Po River", "Rio Pó", "Padus"], ["Po"], "Po (river)", 652],
  ["tagus", "Tagus", "Tejo", ["Tajo", "Rio Tejo"], ["Tajo", "Tejo"], "Tagus", 1007],
  ["douro", "Douro", "Douro", ["Duero", "Rio Douro"], ["Duero", "Douro"], "Douro", 897],
  ["oder", "Oder", "Oder", ["Odra", "Rio Oder"], ["Oder"], "Oder", 840],
  ["vistula", "Vistula", "Vístula", ["Wisła", "Wisla", "Rio Vístula"], ["Vistula"], "Vistula", 1047],
  ["thames", "Thames", "Tâmisa", ["River Thames", "Tamisa", "Rio Tâmisa"], ["Thames"], "River Thames", 346],
  // Asia
  ["yangtze", "Yangtze", "Yangtzé", ["Chang Jiang", "Yangtse", "Rio Azul", "Rio Yangtzé", "Iansequião", "Yangzi"], ["Yangtze", "Chang Jiang", "Jinsha", "Tongtian"], "Yangtze", 6300],
  ["yellow", "Yellow River", "Rio Amarelo", ["Huang He", "Huanghe", "Hwang Ho", "Amarelo"], ["Huang"], "Yellow River", 5464],
  ["mekong", "Mekong", "Mekong", ["Mekong River", "Lancang", "Rio Mekong", "Mecom"], ["Mekong", "Lancang"], "Mekong", 4909],
  ["ganges", "Ganges", "Ganges", ["Ganga", "Padma", "Rio Ganges"], ["Ganges"], "Ganges", 2525],
  ["indus", "Indus", "Indo", ["Sindhu", "Rio Indo", "Indus River"], ["Indus"], "Indus River", 3180],
  ["brahmaputra", "Brahmaputra", "Bramaputra", ["Yarlung Tsangpo", "Jamuna", "Rio Bramaputra", "Brahmaputra River"], ["Brahmaputra", "Yarlung", "Dihang"], "Brahmaputra River", 3969],
  ["euphrates", "Euphrates", "Eufrates", ["Firat", "Fırat", "Al Furat", "Rio Eufrates"], ["Euphrates", "Al Furat", "Firat"], "Euphrates", 2800],
  ["tigris", "Tigris", "Tigre", ["Dicle", "Dijla", "Rio Tigre"], ["Tigris", "Dicle"], "Tigris", 1850],
  ["amur", "Amur", "Amur", ["Heilong Jiang", "Heilongjiang", "Rio Amur"], ["Amur", "Heilong Jiang"], "Amur", 2824],
  ["lena", "Lena", "Lena", ["Lena River", "Rio Lena"], ["Lena"], "Lena River", 4400],
  ["yenisei", "Yenisei", "Ienissei", ["Yenisey", "Enisei", "Rio Ienissei", "Ienissei"], ["Yenisey", "Verkhniy Yenisey", "Malyy Yenisey"], "Yenisei", 3487],
  ["irrawaddy", "Irrawaddy", "Irauádi", ["Ayeyarwady", "Irawadi", "Rio Irauádi"], ["Ayeyarwady"], "Irrawaddy River", 2170],
  ["salween", "Salween", "Salween", ["Thanlwin", "Nu", "Nujiang", "Saluen", "Rio Salween"], ["Salween", "Nu"], "Salween River", 2815],
  ["amu-darya", "Amu Darya", "Amu Dária", ["Amudarya", "Oxus", "Panj", "Rio Amu Dária"], ["Amu  Darya", "Panj"], "Amu Darya", 2540],
  ["jordan", "Jordan", "Jordão", ["Jordan River", "Rio Jordão", "Yarden"], ["Jordan"], "Jordan River", 251],
  // North America
  ["mississippi", "Mississippi", "Mississippi", ["Mississippi River", "Rio Mississippi", "Mississipi"], ["Mississippi"], "Mississippi River", 3730],
  ["missouri", "Missouri", "Missouri", ["Missouri River", "Rio Missouri"], ["Missouri"], "Missouri River", 3767],
  ["colorado", "Colorado", "Colorado", ["Colorado River", "Rio Colorado"], ["Colorado"], "Colorado River", 2330],
  ["rio-grande", "Rio Grande", "Rio Grande", ["Río Bravo", "Rio Bravo", "Río Bravo del Norte"], ["Rio Grande"], "Rio Grande", 3051],
  ["st-lawrence", "St. Lawrence", "São Lourenço", ["Saint Lawrence", "Saint-Laurent", "Rio São Lourenço", "St Lawrence"], ["St. Lawrence"], "St. Lawrence River", 1197],
  ["yukon", "Yukon", "Yukon", ["Yukon River", "Rio Yukon"], ["Yukon"], "Yukon River", 3190],
  ["mackenzie", "Mackenzie", "Mackenzie", ["Mackenzie River", "Deh Cho", "Rio Mackenzie"], ["Mackenzie"], "Mackenzie River", 1738],
  ["columbia", "Columbia", "Colúmbia", ["Columbia River", "Rio Colúmbia"], ["Columbia"], "Columbia River", 2000],
  // South America
  ["amazon", "Amazon", "Amazonas", ["Amazon River", "Rio Amazonas", "Solimões", "Amazonas"], ["Amazonas"], "Amazon River", 6400],
  ["parana", "Paraná", "Paraná", ["Parana", "Paraná River", "Rio Paraná"], ["Paraná"], "Paraná River", 4880],
  ["sao-francisco", "São Francisco", "São Francisco", ["Sao Francisco", "Velho Chico", "Rio São Francisco"], ["São  Francisco"], "São Francisco River", 2830],
  ["orinoco", "Orinoco", "Orinoco", ["Orinoco River", "Rio Orinoco"], ["Orinoco"], "Orinoco", 2140],
  ["uruguay", "Uruguay", "Uruguai", ["Uruguay River", "Rio Uruguai", "Río Uruguay"], ["Uruguay"], "Uruguay River", 1838],
  ["magdalena", "Magdalena", "Magdalena", ["Magdalena River", "Rio Magdalena", "Río Grande de la Magdalena"], ["Magdalena"], "Magdalena River", 1528],
  ["tocantins", "Tocantins", "Tocantins", ["Tocantins River", "Rio Tocantins"], ["Tocantins"], "Tocantins River", 2450],
  // Oceania
  ["murray", "Murray", "Murray", ["Murray River", "River Murray", "Rio Murray"], ["Murray"], "Murray River", 2508],
  ["darling", "Darling", "Darling", ["Darling River", "Baaka", "Rio Darling"], ["Darling"], "Darling River", 1472],
];

const RANGES = [
  ["alps", "Alps", "Alpes", ["The Alps", "Alpen", "Alpi"], ["ALPS"], "Alps", 1200],
  ["andes", "Andes", "Andes", ["Andes Mountains", "Cordilheira dos Andes", "Cordillera de los Andes"], ["ANDES"], "Andes", 8900],
  ["himalayas", "Himalayas", "Himalaia", ["Himalaya", "Himalaias", "Himalayan Mountains", "Himalaya Mountains"], ["HIMALAYAS"], "Himalayas", 2400],
  ["rockies", "Rocky Mountains", "Montanhas Rochosas", ["Rockies", "Rochosas"], ["ROCKY MOUNTAINS"], "Rocky Mountains", 4800],
  ["appalachians", "Appalachian Mountains", "Montes Apalaches", ["Appalachians", "Apalaches"], ["APPALACHIAN MTS."], "Appalachian Mountains", null],
  ["urals", "Ural Mountains", "Montes Urais", ["Urals", "Urais", "Ural"], ["URAL MOUNTAINS"], "Ural Mountains", 2500],
  ["caucasus", "Caucasus Mountains", "Cáucaso", ["Caucasus", "Greater Caucasus", "Montes Cáucaso", "Cordilheira do Cáucaso"], ["CAUCASUS MTS."], "Caucasus Mountains", 1200],
  ["pyrenees", "Pyrenees", "Pirineus", ["Pyrénées", "Pirineos", "Montes Pirineus"], ["PYRENEES"], "Pyrenees", 430],
  ["carpathians", "Carpathian Mountains", "Cárpatos", ["Carpathians", "Montes Cárpatos"], ["CARPATHIAN MOUNTAINS", "Transylvanian Alps"], "Carpathian Mountains", 1500],
  ["atlas", "Atlas Mountains", "Montes Atlas", ["Atlas", "Cordilheira do Atlas"], ["ATLAS MOUNTAINS", "HAUT ATLAS", "ATLAS SAHARIEN", "Moyen Atlas", "Atlas Tellien"], "Atlas Mountains", 2500],
  ["drakensberg", "Drakensberg", "Drakensberg", ["Dragon Mountains", "uKhahlamba", "Montes Drakensberg"], ["DRAKENSBERG"], "Drakensberg", 1000],
  ["great-dividing-range", "Great Dividing Range", "Grande Cordilheira Divisória", ["Eastern Highlands", "Cordilheira Australiana"], ["GREAT DIVIDING RANGE"], "Great Dividing Range", 3500],
  ["hindu-kush", "Hindu Kush", "Indocuche", ["Hindukush", "Hindu Cuche"], ["HINDU KUSH"], "Hindu Kush", 800],
  ["karakoram", "Karakoram", "Caracórum", ["Karakorum", "Caracoram"], ["KARAKORAM RA."], "Karakoram", 500],
  ["tian-shan", "Tian Shan", "Tian Shan", ["Tien Shan", "Tianshan", "Celestial Mountains", "Montes Celestiais"], ["TIAN SHAN"], "Tian Shan", 2500],
  ["altai", "Altai Mountains", "Montes Altai", ["Altai", "Altay"], ["ALTAY MOUNTAINS"], "Altai Mountains", 2000],
  ["zagros", "Zagros Mountains", "Montes Zagros", ["Zagros", "Cordilheira de Zagros"], ["ZAGROS MOUNTAINS"], "Zagros Mountains", 1600],
  ["apennines", "Apennines", "Apeninos", ["Appennini", "Apennine Mountains", "Montes Apeninos"], ["APPENNINI"], "Apennine Mountains", 1200],
  ["scandinavian", "Scandinavian Mountains", "Alpes Escandinavos", ["Scandes", "Kjølen", "Kölen", "Montes Escandinavos"], ["KJØLEN MOUNTAINS"], "Scandinavian Mountains", 1700],
  ["sierra-madre-occidental", "Sierra Madre Occidental", "Serra Madre Ocidental", ["Sierra Madre Ocidental"], ["SIERRA MADRE OCCIDENTAL"], "Sierra Madre Occidental", null],
  ["pamirs", "Pamir Mountains", "Pamir", ["Pamirs", "Pamir", "Montes Pamir"], ["PAMIRS"], "Pamir Mountains", null],
  ["southern-alps", "Southern Alps", "Alpes do Sul", ["Kā Tiritiri o te Moana", "Alpes Neozelandeses"], ["SOUTHERN ALPS"], "Southern Alps", 500],
  ["dinaric-alps", "Dinaric Alps", "Alpes Dináricos", ["Dinarides", "Dináricos"], ["Dinaric Alps"], "Dinaric Alps", 645],
  ["western-ghats", "Western Ghats", "Gates Ocidentais", ["Sahyadri", "Ghats Ocidentais"], ["WESTERN GHATS", "Southern Ghats"], "Western Ghats", 1600],
  ["balkan-mountains", "Balkan Mountains", "Montes Bálcãs", ["Stara Planina", "Balkans", "Bálcãs"], ["Balkan Mts."], "Balkan Mountains", 560],
  ["kunlun", "Kunlun Mountains", "Montes Kunlun", ["Kunlun", "Kunlun Shan"], ["KUNLUN MOUNTAINS"], "Kunlun Mountains", 3000],
  ["cascades", "Cascade Range", "Cordilheira das Cascatas", ["Cascades", "Cascade Mountains", "Cascatas"], ["CASCADE RANGE"], "Cascade Range", 1100],
];

// Where the shapes are too coarse for the truth: countries to add or drop.
const ADD = {
  danube: ["md", "ua", "rs", "hr", "bg", "ro", "sk", "hu", "at", "de"],
  rhine: ["li", "at", "ch", "fr", "de", "nl"],
  nile: ["ug", "ss", "sd", "eg", "et"],
  congo: ["cd", "cg", "ao"],
  niger: ["gn", "ml", "ne", "bj", "ng"],
  zambezi: ["zm", "ao", "na", "bw", "zw", "mz"],
  orange: ["ls", "za", "na"],
  limpopo: ["za", "bw", "zw", "mz"],
  senegal: ["ml", "mr", "sn"],
  okavango: ["ao", "na", "bw"],
  mekong: ["cn", "mm", "la", "th", "kh", "vn"],
  indus: ["cn", "in", "pk"],
  brahmaputra: ["cn", "in", "bd"],
  euphrates: ["tr", "sy", "iq"],
  tigris: ["tr", "sy", "iq"],
  amur: ["ru", "cn"],
  salween: ["cn", "mm", "th"],
  "amu-darya": ["af", "tj", "uz", "tm"],
  jordan: ["il", "jo", "ps", "sy"],
  colorado: ["us", "mx"],
  "rio-grande": ["us", "mx"],
  "st-lawrence": ["ca", "us"],
  yukon: ["ca", "us"],
  columbia: ["ca", "us"],
  amazon: ["pe", "co", "br"],
  parana: ["br", "py", "ar"],
  orinoco: ["ve", "co"],
  uruguay: ["br", "ar", "uy"],
  elbe: ["cz", "de"],
  oder: ["cz", "pl", "de"],
  dnieper: ["ru", "by", "ua"],
  dniester: ["ua", "md"],
  rhone: ["ch", "fr"],
  tagus: ["es", "pt"],
  douro: ["es", "pt"],
  ganges: ["in", "bd"],
  alps: ["fr", "mc", "it", "ch", "li", "de", "at", "si"],
  andes: ["ve", "co", "ec", "pe", "bo", "cl", "ar"],
  himalayas: ["in", "np", "bt", "cn", "pk"],
  rockies: ["ca", "us"],
  appalachians: ["us", "ca"],
  urals: ["ru", "kz"],
  caucasus: ["ru", "ge", "az", "am"],
  pyrenees: ["es", "fr", "ad"],
  carpathians: ["cz", "sk", "pl", "hu", "ua", "ro", "rs", "at"],
  atlas: ["ma", "dz", "tn"],
  drakensberg: ["za", "ls"],
  "hindu-kush": ["af", "pk"],
  karakoram: ["pk", "in", "cn"],
  "tian-shan": ["cn", "kg", "kz", "uz"],
  altai: ["ru", "cn", "mn", "kz"],
  zagros: ["ir", "iq"],
  scandinavian: ["no", "se", "fi"],
  pamirs: ["tj", "af", "cn", "kg"],
  "dinaric-alps": ["si", "hr", "ba", "me", "rs", "al", "xk"],
  "balkan-mountains": ["bg", "rs"],
  cascades: ["us", "ca"],
};
const DROP = {
  // A graze in the coarse shapes, or a source stream rather than the river or range itself.
  yenisei: ["mn"],
  apennines: ["sm"],
  jordan: ["lb", "sy"],
  "hindu-kush": ["in"],
  drakensberg: ["sz"],
  carpathians: ["at"],
};
/** Countries that count as close too (no strike), beyond Wikidata's: near the course, or in its sources. */
const NEAR = {
  jordan: ["lb", "sy"],
  drakensberg: ["sz"],
  carpathians: ["at"],
  caucasus: ["tr", "ir"],
  "dinaric-alps": ["it"],
  "hindu-kush": ["tj"],
  nile: ["tz", "ke", "rw", "bi", "cd", "er"],
  amazon: ["bo", "ec", "ve"],
  himalayas: ["af", "mm"],
};
/** Natural Earth names some rivers elsewhere too: only segments inside this box [west, south, east, north] count. */
const WITHIN = {
  colorado: [-120, 28, -104, 44],
  mackenzie: [-140, 55, -100, 72],
  jordan: [35, 31, 36.2, 33.5],
  columbia: [-125, 44, -114, 53],
  orange: [14, -32, 30, -26],
  niger: [-15, 3, 10, 18],
};
/** Where Natural Earth draws a river as sea (a wide estuary), its line by hand: [lon, lat]. */
const DRAWN = {
  "st-lawrence": [
    [
      [-76.35, 44.15], [-75.8, 44.5], [-74.7, 45.0], [-74.0, 45.3], [-73.55, 45.55], [-73.1, 45.95], [-72.55, 46.35],
      [-71.9, 46.65], [-71.2, 46.82], [-70.6, 47.15], [-69.9, 47.6], [-69.2, 48.15], [-68.4, 48.6], [-67.4, 49.3],
    ],
  ],
};

// ── Downloads ───────────────────────────────────────────────────────────────

async function cached(name) {
  mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${name}.geojson`);
  if (!existsSync(file)) {
    console.log(`Downloading ${name}…`);
    const response = await fetch(`${NE}${name}.geojson`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    writeFileSync(file, await response.text());
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Each English Wikipedia title's P205 (basin country) and P17 (country), by ISO code: one SPARQL query. */
async function wikidataCountries(titles) {
  const cache = existsSync(WIKIDATA_CACHE) ? JSON.parse(readFileSync(WIKIDATA_CACHE, "utf8")) : {};
  const missing = titles.filter((title) => !(title in cache));
  if (missing.length) {
    const values = missing.map((title) => JSON.stringify(title) + "@en").join(" ");
    const query = `SELECT ?title ?item ?prop ?iso WHERE {
      VALUES ?title { ${values} }
      ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title.
      OPTIONAL { { ?item wdt:P205 ?c. BIND("basin" AS ?prop) } UNION { ?item wdt:P17 ?c. BIND("country" AS ?prop) } ?c wdt:P297 ?iso. }
    }`;
    let json = null;
    for (let attempt = 0; attempt < 4 && !json; attempt++) {
      const response = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query }),
      });
      if (response.ok) json = await response.json();
      else await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
    }
    if (!json) throw new Error("Wikidata SPARQL failed");
    for (const title of missing) cache[title] = null;
    for (const row of json.results.bindings) {
      const title = row.title.value;
      const entry = (cache[title] ??= { qid: row.item.value.split("/").pop(), basin: [], country: [] });
      if (row.prop && row.iso) {
        const iso = row.iso.value.toLowerCase();
        if (!entry[row.prop.value].includes(iso)) entry[row.prop.value].push(iso);
      }
    }
    writeFileSync(WIKIDATA_CACHE, JSON.stringify(cache, null, 1));
  }
  return cache;
}

// ── Geometry ────────────────────────────────────────────────────────────────

const key = ([lon, lat]) => `${lon.toFixed(4)},${lat.toFixed(4)}`;

/** Joins segments that meet end to end into longer lines. */
function chain(segments) {
  const lines = segments.map((line) => [...line]);
  let joined = true;
  while (joined) {
    joined = false;
    outer: for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue;
        const a = lines[i];
        const b = lines[j];
        if (key(a.at(-1)) === key(b[0])) lines[i] = [...a, ...b.slice(1)];
        else if (key(a.at(-1)) === key(b.at(-1))) lines[i] = [...a, ...[...b].reverse().slice(1)];
        else if (key(a[0]) === key(b.at(-1))) lines[i] = [...b, ...a.slice(1)];
        else if (key(a[0]) === key(b[0])) lines[i] = [...[...b].reverse(), ...a.slice(1)];
        else continue;
        lines.splice(j, 1);
        joined = true;
        break outer;
      }
    }
  }
  return lines;
}

/** Douglas–Peucker in degrees (fine at this scale). */
function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let at = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (n) => Math.round(n * 100) / 100;
const roundLine = (line) => {
  const out = [];
  for (const [lon, lat] of line) {
    const point = [round(lon), round(lat)];
    const last = out.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  return out;
};

const degrees = (line) => line.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);

/** Points every `step` degrees along a line. */
function densify(line, step) {
  const out = [];
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let s = 0; s < n; s++) out.push([ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n]);
  }
  out.push(line.at(-1));
  return out;
}

/** A simplification tolerance for a feature: a fraction of its size, so a short river keeps its bends. */
function tolerance(lines, parts, most) {
  const points = lines.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.min(most, Math.max(0.01, extent / parts));
}

/** A closed ring, simplified in two halves (its ends are the same point). */
function simplifyRing(ring, tolerance) {
  const [x0, y0] = ring[0];
  let far = 1;
  ring.forEach(([x, y], i) => {
    if (Math.hypot(x - x0, y - y0) > Math.hypot(ring[far][0] - x0, ring[far][1] - y0)) far = i;
  });
  return [...simplify(ring.slice(0, far + 1), tolerance), ...simplify(ring.slice(far), tolerance).slice(1)];
}

// ── The world's countries ───────────────────────────────────────────────────

const countries = JSON.parse(readFileSync(path.join(ROOT, "lib/data/countries.json"), "utf8"));
const regions = JSON.parse(readFileSync(path.join(ROOT, "lib/data/regions.json"), "utf8"));
const isoOfShape = new Map(countries.flatMap((country) => country.shapes.map((shape) => [shape, country.id])));
const topology = JSON.parse(readFileSync(path.join(ROOT, "public/geo/countries-50m.json"), "utf8"));
const shapes = feature(topology, topology.objects.countries)
  .features.filter((shape) => isoOfShape.has(shape.properties.name))
  .map((shape) => {
    const [[west, south], [east, north]] = geoBounds(shape);
    return { shape, iso: isoOfShape.get(shape.properties.name), west, south, east, north };
  });

/** The country a point is in, if any. */
function countryAt(point) {
  const [lon, lat] = point;
  for (const entry of shapes) {
    if (lat < entry.south - 0.01 || lat > entry.north + 0.01) continue;
    if (entry.west <= entry.east && (lon < entry.west - 0.01 || lon > entry.east + 0.01)) continue;
    if (geoContains(entry.shape, point)) return entry.iso;
  }
  return null;
}

/** Countries by share of the sample points, and the continent most of them are in. */
function tally(points, minShare, minCount) {
  const counts = new Map();
  let placed = 0;
  for (const point of points) {
    const iso = countryAt(point);
    if (!iso) continue;
    placed++;
    counts.set(iso, (counts.get(iso) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const kept = ranked.filter(([, n]) => n >= minCount && n / placed >= minShare).map(([iso]) => iso);
  const byContinent = new Map();
  for (const [iso, n] of ranked) {
    const region = regions[iso];
    if (region) byContinent.set(region, (byContinent.get(region) ?? 0) + n);
  }
  const continent = [...byContinent].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { kept, ranked, continent };
}

/** Whether a point is inside a polygon ring (planar, fine for a range). */
function inRing(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const lengthKm = (lines) =>
  Math.round(lines.reduce((sum, line) => sum + line.slice(1).reduce((s, p, i) => s + geoDistance(line[i], p) * 6371, 0), 0));

// ── Build ───────────────────────────────────────────────────────────────────

const rivers = await cached("ne_10m_rivers_lake_centerlines");
const regionPolys = await cached("ne_10m_geography_regions_polys");
const wiki = await wikidataCountries([...RIVERS, ...RANGES].map((entry) => entry[5]));

const out = [];
const report = [];
const continentOverride = { urals: "europe", caucasus: "europe", amur: "asia", lena: "asia", yenisei: "asia" };

function finish(kind, [id, en, pt, also, , title, km], lines, sampled) {
  const wikiEntry = wiki[title];
  const computed = sampled.kept;
  const set = new Set([...computed, ...(ADD[id] ?? [])]);
  for (const iso of DROP[id] ?? []) set.delete(iso);
  const valid = new Set(countries.map((country) => country.id));
  const list = [...set].filter((iso) => valid.has(iso));
  const known = new Set([...(wikiEntry?.basin ?? []), ...(wikiEntry?.country ?? []), ...(NEAR[id] ?? [])]);
  const basin = [...known].filter((iso) => valid.has(iso) && !set.has(iso)).sort();
  const totalPoints = lines.reduce((n, line) => n + line.length, 0);
  report.push(
    `${kind.padEnd(5)} ${id.padEnd(24)} pts ${String(totalPoints).padStart(4)}  ${list.join(",")}` +
      `  [computed ${sampled.ranked.map(([iso, n]) => `${iso}:${n}`).join(" ")}]` +
      (basin.length ? `  basin+ ${basin.join(",")}` : "") +
      (wikiEntry ? "" : "  (no wikidata)"),
  );
  out.push({
    id,
    kind,
    name: { en, pt },
    also,
    continent: continentOverride[id] ?? sampled.continent,
    lines,
    countries: list,
    ...(basin.length ? { basin } : {}),
    ...(km ? { lengthKm: km } : {}),
  });
}

for (const entry of RIVERS) {
  const [id, , , , names] = entry;
  const wanted = new Set(names);
  const box = WITHIN[id];
  const inBox = (line) => !box || line.every(([lon, lat]) => lon >= box[0] && lat >= box[1] && lon <= box[2] && lat <= box[3]);
  const segments =
    DRAWN[id] ??
    rivers.features
      .filter((f) => wanted.has(f.properties.name) || wanted.has(f.properties.name_en))
      .flatMap((f) => (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates))
      .filter(inBox);
  if (!segments.length) throw new Error(`No river segments for ${id}`);
  const joined = chain(segments);
  const longest = Math.max(...joined.map(degrees));
  // Keep the main lines; little side channels and delta arms go.
  const main = joined.filter((line) => degrees(line) >= Math.max(0.4, longest * 0.08));
  const samples = main.flatMap((line) => densify(line, 0.04));
  const sampled = tally(samples, 0.015, 3);
  const lines = main.map((line) => roundLine(simplify(line, tolerance(main, 150, 0.06)))).filter((line) => line.length >= 2);
  finish("river", entry, lines, sampled);
  if (entry[6] && Math.abs(lengthKm(main) - entry[6]) / entry[6] > 0.6) report.push(`  ! ${id}: drawn ${lengthKm(main)} km vs ${entry[6]} km`);
}

for (const entry of RANGES) {
  const [id, , , , names] = entry;
  const wanted = new Set(names);
  const polys = regionPolys.features
    .filter((f) => f.properties.FEATURECLA === "Range/mtn" && wanted.has(f.properties.NAME))
    .flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates));
  if (!polys.length) throw new Error(`No range polygons for ${id}`);
  const rings = polys.map((poly) => poly[0]);
  // A grid inside the outlines, fine enough for a few hundred points each.
  const samples = [];
  for (const ring of rings) {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const [w, e, s, n] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const step = Math.max(0.04, Math.sqrt(((e - w) * (n - s)) / 1500));
    for (let x = w + step / 2; x < e; x += step) for (let y = s + step / 2; y < n; y += step) if (inRing(ring, [x, y])) samples.push([x, y]);
    samples.push(...densify(ring, step));
  }
  const sampled = tally(samples, 0.02, 3);
  const biggest = Math.max(...rings.map(degrees));
  const lines = rings
    .filter((ring) => degrees(ring) >= biggest * 0.15)
    .map((ring) => roundLine(simplifyRing(ring, tolerance(rings, 120, 0.07))))
    .filter((ring) => ring.length >= 4);
  finish("range", entry, lines, sampled);
}

// No line may jump across the antimeridian.
for (const item of out) {
  for (const line of item.lines) {
    for (let i = 1; i < line.length; i++) {
      if (Math.abs(line[i][0] - line[i - 1][0]) > 90) throw new Error(`${item.id} crosses the antimeridian`);
    }
  }
}

mkdirSync(path.dirname(TARGET), { recursive: true });
const text = JSON.stringify(out);
writeFileSync(TARGET, text + "\n");
console.log(report.join("\n"));
console.log(`\n${out.length} features (${out.filter((f) => f.kind === "river").length} rivers), ${(text.length / 1024).toFixed(1)} KB → ${path.relative(ROOT, TARGET)}`);
