// Builds the two pools of Landmark Lens (games/landmark-lens/data/):
//
//   landmarks.json  world-famous landmarks (towers, bridges, palaces, natural
//                   wonders…) from Wikidata (CC0): names, coordinates (P625),
//                   country (P17 → ISO code, P297) and photos from Wikimedia
//                   Commons (P18, then the Wikipedia articles' lead photos),
//                   each with its own credit and licence.
//   sites.json      Dig Site's sites in the same shape, read from
//                   games/dig-site/data/ (never written): its main photo and up
//                   to two of its gallery's, already downloaded under public/sites/.
//
//   node scripts/fetch-landmarks.mjs            both
//   node scripts/fetch-landmarks.mjs --sites    only sites.json (no network)
//
// Photos are fitted inside 640×800, saved as JPEGs under public/landmarks/
// with opaque names (a file called eiffel.jpg gives the answer away). The run
// is resumable: photos already saved are kept, and Wikimedia's answers are
// cached in scripts/.cache. upload.wikimedia.org rate-limits long runs; the
// script waits and, past that, ships the landmarks it has.

import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  ROOT,
  best,
  cleanTitle,
  countryId,
  creditFrom,
  getEntities,
  getJson,
  imageFileOf,
  label,
  plain,
  politeFetch,
  setPace,
  slugify,
} from "./lib/wiki.mjs";

setPace(1500);

const OUT_DIR = path.join(ROOT, "games/landmark-lens/data");
const LANDMARKS_JSON = path.join(OUT_DIR, "landmarks.json");
const SITES_JSON = path.join(OUT_DIR, "sites.json");
const DIG_SITES = path.join(ROOT, "games/dig-site/data/sites.json");
const DIG_GALLERY = path.join(ROOT, "games/dig-site/data/gallery.json");
const COUNTRIES = path.join(ROOT, "lib/data/countries.json");
const FOLDER = "landmarks";
const PHOTO_DIR = path.join(ROOT, "public", FOLDER);
const SITES_ONLY = process.argv.includes("--sites");

/** Photos per landmark, at most. */
const PHOTOS = 3;
const WIDTH = 640;
const HEIGHT = 800;
const FETCH_WIDTH = 960;
const MIN_WIDTH = 600;
const QUALITY = 72;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// ── The roster ──────────────────────────────────────────────────────────────
// English Wikipedia titles (the Wikidata item comes from the article). `name`
// overrides the names (`id` then keeps the old one, and its photos); `country`
// the ISO code, where Wikidata names two or none that is on the map.
// `drop` names Commons files not to use (a silhouette at sunset, a night shot,
// a close-up: photos nobody could place). Landmarks shared by two countries
// (a falls on a border, a mountain on a ridge) are left out: the country bonus
// would be a coin toss; so are those whose only free photos were unplaceable
// (Sheikh Zayed Grand Mosque, Hassan II Mosque, Salar de Uyuni).

const ROSTER = [
  // Europe
  { title: "Eiffel Tower" },
  { title: "Big Ben", name: { en: "Big Ben", pt: "Big Ben" } },
  { title: "Tower Bridge" },
  { title: "Colosseum", name: { en: "Colosseum", pt: "Coliseu" } },
  { title: "Leaning Tower of Pisa" },
  { title: "Parthenon" },
  {
    title: "Sagrada Família",
    name: { en: "Sagrada Família", pt: "Sagrada Família" },
  },
  { title: "Neuschwanstein Castle" },
  { title: "Brandenburg Gate" },
  { title: "Saint Basil's Cathedral" },
  { title: "Atomium" },
  {
    title: "Kapellbrücke",
    name: { en: "Chapel Bridge", pt: "Ponte da Capela" },
  },
  { title: "Belém Tower" },
  { title: "Hungarian Parliament Building" },
  { title: "Hagia Sophia" },
  { title: "Mont-Saint-Michel" },
  { title: "Edinburgh Castle" },
  { title: "Cliffs of Moher", drop: ["Cliffs of Moher Ireland 1.jpg"] },
  {
    title: "Rijksmuseum",
    country: "nl",
    name: { en: "Rijksmuseum", pt: "Rijksmuseum" },
  },
  { title: "Alhambra" },
  // Asia
  { title: "Taj Mahal" },
  {
    title: "Burj Khalifa",
    drop: [
      "Burj Khalifa (worlds tallest building) and the Dubai skyline (25781049892).jpg",
    ],
  },
  {
    title: "Petronas Towers",
    name: { en: "Petronas Towers", pt: "Torres Petronas" },
  },
  { title: "Marina Bay Sands" },
  {
    title: "Forbidden City",
    drop: ["The Forbidden City - View from Coal Hill.jpg"],
  },
  { title: "Potala Palace", country: "cn" },
  { title: "Mount Fuji" },
  { title: "Tokyo Tower" },
  { title: "Gyeongbokgung" },
  { title: "Shwedagon Pagoda" },
  { title: "Taipei 101" },
  { title: "Ha Long Bay" },
  { title: "Grand Palace", name: { en: "Grand Palace", pt: "Grande Palácio" } },
  { title: "Registan" },
  {
    title: "Golden Temple",
    name: { en: "Golden Temple", pt: "Templo Dourado" },
  },
  // Africa
  { title: "Great Pyramid of Giza" },
  { title: "Table Mountain" },
  { title: "Mount Kilimanjaro" },
  { title: "Great Mosque of Djenné" },
  { title: "Deadvlei" },
  // North America
  { title: "Statue of Liberty" },
  { title: "Golden Gate Bridge" },
  { title: "Mount Rushmore" },
  { title: "Grand Canyon" },
  { title: "CN Tower" },
  { title: "Palacio de Bellas Artes" },
  { title: "Château Frontenac" },
  {
    title: "El Capitolio",
    id: "national-capitol-of-cuba",
    name: { en: "El Capitolio", pt: "Capitólio de Havana" },
    drop: ["Havana - Capitol inauguration.jpg"],
  },
  // South America
  { title: "Christ the Redeemer (statue)" },
  { title: "Sugarloaf Mountain" },
  { title: "Perito Moreno Glacier", country: "ar" },
  { title: "Angel Falls" },
  {
    title: "Torres del Paine National Park",
    name: { en: "Torres del Paine", pt: "Torres del Paine" },
  },
  {
    title: "Obelisco de Buenos Aires",
    drop: ["Buenos Aires (20234294752).jpg"],
  },
  { title: "Cathedral of Brasília" },
  // Oceania
  { title: "Sydney Opera House" },
  { title: "Sydney Harbour Bridge" },
  { title: "Uluru" },
  { title: "Milford Sound" },
  {
    title: "Sky Tower (Auckland)",
    drop: ["Auckland Sky Tower closeup.jpg", "Sky Tower from bottom.jpg"],
  },
];

// ── Dig Site's country names → ISO codes ────────────────────────────────────

const fold = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Names Wikidata uses that the map's countries do not. */
const COUNTRY_BY_HAND = {
  "federated states of micronesia": "fm",
  "state of palestine": "ps",
  palestine: "ps",
  turkey: "tr",
  "people s republic of china": "cn",
  "kingdom of the netherlands": "nl",
};

function countryLookup(countries) {
  const byName = new Map();
  for (const country of countries) {
    for (const name of [
      country.name.en,
      country.name.pt,
      ...(country.also ?? []),
    ])
      byName.set(fold(name), country.id);
  }
  return (name) =>
    name
      ? (COUNTRY_BY_HAND[fold(name)] ?? byName.get(fold(name)) ?? null)
      : null;
}

/**
 * Dig Site photos (by Commons file) that are fine in its gallery but no use
 * here, where the photo is all a player gets: a map, a collage, an artefact, a
 * relief, a portrait, a sunset. A site with nothing left (a cave painting, a
 * tunnel) is left out.
 */
const SITE_DROP = {
  carthage: ["Montage ville de Carthage.png"],
  tikal: ["DSC03332TikalUnderjordiskSteinansikt.JPG"],
  knossos: ["Crete integrated map-en.svg", "RhodesIntérieurDuPalais.JPG"],
  timbuktu: [
    "Fennek in Timboektoe.jpg",
    "ASC Leiden - van Achterberg Collection - 04 - 61 - Le Touareg Mohamed - Tombouctou, Mali - Novembre-décembre 1993.jpg",
  ],
  "gobekli-tepe": ["Klaus Schmidt Monumento 2014 5.jpg"],
  catalhoyuk: ["Catal Hüyük EL.JPG"],
  ur: [
    "Urimki inscription.jpg",
    "Foundation nail Entemena Louvre AO22934.jpg",
    "OLD tar (like our cement or mortar) but 2500 - 6000 y.o..JPG",
  ],
  nineveh: ["Nineveh Nebi Yunus Excavation Bull-Man Head.JPG"],
  "leptis-magna": ["Market Leptis Magna 03.JPG"],
  "chan-chan": ["Palacio Nik An (Tschudi) - Detalle de peces.jpg"],
  copan: ["Copan sculpture.jpg", "CPN Rosalila 01.jpg"],
  palenque: ["Palenque Collage.jpg"],
  "mesa-verde": ["Basket of Basketmaker Pueblo people.jpg"],
  stonehenge: [
    "Sun behind the Heel Stone.jpg",
    "Summer Solstice Sunrise over Stonehenge 2005.jpg",
  ],
  newgrange: ["Ireland 2010 etc 079.jpg", "Newgrange 075.jpg"],
  "kilwa-kisiwani": ["Kilwa Kisiwani Dancers (33355937164).jpg"],
  amarna: ["BastónArrojadizoEgipcio (31261007387).jpg"],
  "serra-da-capivara": ["Serra da Capivara - Several Paintings 3.jpg"],
  lascaux: ["Lascaux painting.jpg"],
  derinkuyu: ["Derinkuyu Underground City 9910 Nevit.jpg"],
};

/** Gallery photos most likely to show the whole place: views first, details last. */
const VIEW =
  /\b(view|panorama|overview|aerial|general|from above|vista|landscape|skyline)\b/i;
const DETAIL =
  /\b(detail|interior|inside|relief|reliefs|statue|inscription|museum|mosaic|fresco|carving|carved|artifact|artefact|close|closeup|sculpture|painting|figurine|pottery|tablet|seal|jar|vase|skull|bones|exhibit)\b/i;

function viewScore(photo) {
  const text = `${photo.caption?.en ?? ""} ${photo.caption?.pt ?? ""} ${photo.credit?.file ?? ""}`;
  const ratio = photo.width / photo.height;
  return (
    (VIEW.test(text) ? 2 : 0) +
    (ratio >= 1.25 ? 1 : 0) -
    (DETAIL.test(text) ? 5 : 0) -
    (ratio < 0.8 ? 1 : 0)
  );
}

async function buildSites(countries) {
  const countryOf = countryLookup(countries);
  const sites = JSON.parse(await readFile(DIG_SITES, "utf8"));
  const gallery = JSON.parse(await readFile(DIG_GALLERY, "utf8"));
  const out = [];
  for (const site of sites) {
    if (!site.image || site.lat === null || site.lon === null) continue;
    const country = countryOf(site.country?.en);
    if (!country) {
      console.log(`  ⚠ ${site.id}: no country for "${site.country?.en}"`);
      continue;
    }
    const dropped = (photo) => SITE_DROP[site.id]?.includes(photo.credit?.file);
    const main = dropped(site.image) ? [] : [site.image];
    const extra = (gallery[site.id] ?? [])
      .map((photo, i) => ({ photo, i, score: viewScore(photo) }))
      .filter((entry) => entry.score >= 0 && !dropped(entry.photo))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, PHOTOS - main.length)
      .map((entry) => entry.photo);
    const photos = [...main, ...extra].map(
      ({ src, width, height, credit }) => ({ src, width, height, credit }),
    );
    if (!photos.length) {
      console.log(`  ${site.id}: no photo anyone could place, left out`);
      continue;
    }
    out.push({
      id: site.id,
      name: site.name,
      country,
      lat: site.lat,
      lon: site.lon,
      photos,
    });
  }
  await writeFile(SITES_JSON, JSON.stringify(out) + "\n");
  const size = (await stat(SITES_JSON)).size;
  console.log(
    `Wrote ${path.relative(ROOT, SITES_JSON)}: ${out.length} sites, ${out.reduce((n, s) => n + s.photos.length, 0)} photos, ${(size / 1024).toFixed(0)} KB`,
  );
  return out;
}

// ── Commons ─────────────────────────────────────────────────────────────────

const META_FIELDS =
  "License|LicenseShortName|LicenseUrl|UsageTerms|NonFree|Artist|Credit|Categories";

/** Free licences only: public domain, CC0, CC BY and CC BY-SA (any version). */
function isFree(meta) {
  const value = (key) => plain(meta?.[key]?.value);
  if (value("NonFree") === "true") return false;
  const code = value("License").toLowerCase();
  if (/^(pd\b|pd-|cc0|cc-zero|cc-by-(sa-)?\d(\.\d)?\b)/.test(code)) return true;
  if (code) return false;
  return /^(public domain|pd\b|cc0|cc by(-sa)? \d(\.\d)?\b)/.test(
    value("LicenseShortName").toLowerCase(),
  );
}

const NOT_A_PHOTO =
  /\b(map|plan|diagram|logo|flag|coat of arms|drawing|sketch|engraving|lithograph|illustration|render|model|stamp|coin|postcard|poster|svg)\b/i;

const stem = (file) =>
  file
    .replace(/\.[a-z]+$/i, "")
    .replace(/[\s_]*\((cropped|crop|edit(ed)?|retouched)\)/gi, "")
    .replace(/[\s_]+/g, " ")
    .trim()
    .toLowerCase();

async function fileInfo(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 25) {
    const chunk = files.slice(i, i + 25);
    const url =
      `${COMMONS_API}?action=query&format=json&formatversion=2&prop=imageinfo` +
      `&iiprop=url|size|mime|sha1|extmetadata&iiurlwidth=${FETCH_WIDTH}&iiextmetadatafilter=${META_FIELDS}` +
      `&titles=${encodeURIComponent(chunk.map((f) => `File:${f}`).join("|"))}`;
    const data = await getJson(url);
    const asked = new Map(
      (data.query?.normalized ?? []).map((n) => [n.to, n.from]),
    );
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (page.missing || !info) continue;
      out.set((asked.get(page.title) ?? page.title).replace(/^File:/, ""), {
        ...info,
        file: page.title.replace(/^File:/, ""),
      });
    }
  }
  return out;
}

function rejection(info) {
  if (!["image/jpeg", "image/webp", "image/tiff"].includes(info.mime))
    return "not a photo format";
  if (info.width < MIN_WIDTH || info.height < 400) return "too small";
  const ratio = info.width / info.height;
  if (ratio > 2.4 || ratio < 0.45) return "panorama or strip";
  if (!isFree(info.extmetadata)) return "licence";
  if (NOT_A_PHOTO.test(info.file.replace(/[_-]/g, " "))) return "not a photo";
  if (!info.thumburl || /\.tiff?$/i.test(info.thumburl)) return "no thumbnail";
  return null;
}

const nameOf = (id, file) =>
  createHash("sha1")
    .update(`www:landmark-lens:${id}:${file}`)
    .digest("hex")
    .slice(0, 12);

async function exists(file) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

/** Saves a photo fitted inside WIDTH×HEIGHT; a file already saved is kept. */
async function save(id, info) {
  const file = `${nameOf(id, info.file)}.jpg`;
  const out = path.join(PHOTO_DIR, file);
  if (!(await exists(out))) {
    const res = await politeFetch(info.thumburl);
    await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize({
        width: WIDTH,
        height: HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toFile(out);
    // Downloads are what Wikimedia throttles: space them out.
    await new Promise((r) => setTimeout(r, 2500));
  }
  const meta = await sharp(out).metadata();
  return { src: `/${FOLDER}/${file}`, width: meta.width, height: meta.height };
}

// ── Landmarks ───────────────────────────────────────────────────────────────

/**
 * The Wikidata item, coordinates and lead photo of articles, keyed by the
 * title asked for (in the shape of a REST summary). 40 titles a request.
 */
async function articles(lang, titles) {
  const out = new Map();
  const list = [...new Set(titles)];
  for (let i = 0; i < list.length; i += 40) {
    const chunk = list.slice(i, i + 40);
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1` +
      `&prop=pageprops|pageimages|coordinates&ppprop=wikibase_item&piprop=original` +
      `&titles=${encodeURIComponent(chunk.join("|"))}`;
    const data = await getJson(url);
    const from = new Map();
    for (const n of data.query?.normalized ?? []) from.set(n.to, n.from);
    for (const r of data.query?.redirects ?? [])
      from.set(r.to, from.get(r.from) ?? r.from);
    for (const page of data.query?.pages ?? []) {
      if (page.missing) continue;
      const coord = page.coordinates?.[0];
      out.set(from.get(page.title) ?? page.title, {
        title: page.title,
        wikibase_item: page.pageprops?.wikibase_item,
        coordinates: coord ? { lat: coord.lat, lon: coord.lon } : undefined,
        originalimage: page.original
          ? { source: page.original.source }
          : undefined,
      });
    }
  }
  return out;
}

async function buildLandmarks(countries, sites) {
  await mkdir(PHOTO_DIR, { recursive: true });
  const known = new Set(countries.map((c) => c.id));
  const near = (a, b) =>
    Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;

  let previous = [];
  try {
    previous = JSON.parse(await readFile(LANDMARKS_JSON, "utf8"));
  } catch {}
  const before = new Map(previous.map((entry) => [entry.id, entry]));

  console.log(`Looking up ${ROSTER.length} Wikipedia articles…`);
  const enPages = await articles(
    "en",
    ROSTER.map((entry) => entry.title),
  );
  const summaries = ROSTER.map((entry) => enPages.get(entry.title) ?? {});
  const entities = await getEntities(
    summaries.map((s) => s.wikibase_item).filter(Boolean),
    "labels|claims|sitelinks",
  );
  const ptPages = await articles(
    "pt",
    Object.values(entities)
      .map((e) => e.sitelinks?.ptwiki?.title)
      .filter(Boolean),
  );
  // Each country's ISO code (P297) on its own: whole country items are megabytes
  // each, and a batch of them comes back incomplete.
  const isoOf = new Map();
  for (const item of new Set(
    Object.values(entities)
      .map((e) => countryId(e))
      .filter(Boolean),
  )) {
    const data = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${item}&property=P297`,
    );
    isoOf.set(
      item,
      best({ claims: data.claims ?? {} }, "P297")[0]?.mainsnak.datavalue.value,
    );
  }

  const result = [];
  const ids = new Set(sites.map((s) => s.id));
  for (const [n, entry] of ROSTER.entries()) {
    const summary = summaries[n];
    const entity = entities[summary.wikibase_item];
    const warn = [];
    if (!entity) {
      console.log(`${entry.title}: no Wikidata item`);
      continue;
    }
    const ptTitle = entity.sitelinks?.ptwiki?.title;
    const ptSummary = ptTitle ? ptPages.get(ptTitle) : null;
    const name = entry.name ?? {
      en: cleanTitle(summary.title ?? label(entity, "en")),
      pt: cleanTitle(ptTitle ?? label(entity, "pt") ?? summary.title),
    };
    const id = entry.id ?? slugify(name.en);

    const coord = best(entity, "P625")[0]?.mainsnak.datavalue.value;
    const lat = coord?.latitude ?? summary.coordinates?.lat;
    const lon = coord?.longitude ?? summary.coordinates?.lon;
    const iso = (
      entry.country ??
      isoOf.get(countryId(entity)) ??
      ""
    ).toLowerCase();
    if (lat === undefined) warn.push("no coordinates");
    if (!known.has(iso)) warn.push(`country "${iso}" not on the map`);
    if (ids.has(id)) warn.push("id taken");
    const twin = sites.find((s) => lat !== undefined && near(s, { lat, lon }));
    if (twin) warn.push(`same place as Dig Site's ${twin.id}`);
    if (warn.length) {
      console.log(
        `${String(n + 1).padStart(2)}. ${name.en}: skipped (${warn.join("; ")})`,
      );
      continue;
    }
    ids.add(id);

    // P18 first, then the articles' lead photos.
    const files = [
      ...best(entity, "P18").map((s) => s.mainsnak.datavalue.value),
      imageFileOf(summary.originalimage?.source)?.file,
      imageFileOf(ptSummary?.originalimage?.source)?.file,
    ].filter((file) => file && !entry.drop?.includes(file.replace(/_/g, " ")));
    const infos = await fileInfo([...new Set(files)]);
    const photos = [];
    const stems = new Set();
    const sha1 = new Set();
    const rejected = [];
    for (const file of new Set(files)) {
      if (photos.length >= PHOTOS) break;
      const info = infos.get(file);
      if (!info) continue;
      const why =
        rejection(info) ??
        (stems.has(stem(info.file)) || sha1.has(info.sha1)
          ? "duplicate"
          : null);
      if (why) {
        rejected.push(why);
        continue;
      }
      try {
        const saved = await save(id, info);
        photos.push({
          ...saved,
          credit: creditFrom("commons", info.file, info.extmetadata),
        });
        stems.add(stem(info.file));
        sha1.add(info.sha1);
      } catch (err) {
        console.log(`  ! ${info.file}: ${err.message}`);
      }
    }
    if (!photos.length) {
      const kept = before.get(id);
      if (kept) photos.push(...kept.photos);
      console.log(
        `${String(n + 1).padStart(2)}. ${name.en}: no photo${kept ? " (kept the old ones)" : ""}`,
      );
      if (!photos.length) continue;
    }
    result.push({
      id,
      name,
      country: iso,
      lat: +lat.toFixed(4),
      lon: +lon.toFixed(4),
      photos,
    });
    console.log(
      `${String(n + 1).padStart(2)}. ${name.en} / ${name.pt} — ${iso} ${lat.toFixed(2)}, ${lon.toFixed(2)} — ` +
        `${photos.length} photo(s)${rejected.length ? ` (skipped: ${rejected.join(", ")})` : ""}`,
    );
  }

  await writeFile(LANDMARKS_JSON, JSON.stringify(result) + "\n");

  // Photos nothing points at any more go.
  const used = new Set(
    result.flatMap((entry) =>
      entry.photos.map((photo) => path.basename(photo.src)),
    ),
  );
  let bytes = 0;
  for (const file of await readdir(PHOTO_DIR)) {
    if (!used.has(file)) await unlink(path.join(PHOTO_DIR, file));
    else bytes += (await stat(path.join(PHOTO_DIR, file))).size;
  }
  const size = (await stat(LANDMARKS_JSON)).size;
  console.log(
    `\nWrote ${path.relative(ROOT, LANDMARKS_JSON)}: ${result.length} landmarks, ${used.size} photos ` +
      `(${(bytes / 1024 / 1024).toFixed(1)} MB), ${(size / 1024).toFixed(0)} KB`,
  );
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const countries = JSON.parse(await readFile(COUNTRIES, "utf8"));
  const sites = await buildSites(countries);
  if (!SITES_ONLY) await buildLandmarks(countries, sites);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
