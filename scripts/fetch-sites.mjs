// Builds games/dig-site/data/sites.json from Wikipedia + Wikidata.
//
//   node scripts/fetch-sites.mjs              fetch every site, download photos
//   node scripts/fetch-sites.mjs --no-images  skip photo downloads
//
// The list of sites, with their hand-written clues, is scripts/sites-roster.mjs.
// Coordinates, names, photos and the closing text come from Wikipedia.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  best,
  cleanTitle,
  countryId,
  downloadImage,
  getEntities,
  getPtSummary,
  getSummary,
  label,
  merge,
  slugify,
} from "./lib/wiki.mjs";
import { SITES, SITE_OVERRIDES } from "./sites-roster.mjs";

const OUT_JSON = path.join(ROOT, "games/dig-site/data/sites.json");
const SKIP_IMAGES = process.argv.includes("--no-images");

async function main() {
  await mkdir(path.dirname(OUT_JSON), { recursive: true });

  const previous = new Map();
  try {
    for (const s of JSON.parse(await readFile(OUT_JSON, "utf8"))) previous.set(s.id, s);
  } catch {}

  console.log(`Fetching ${SITES.length} Wikipedia summaries…`);
  const summaries = [];
  for (const { title } of SITES) summaries.push(await getSummary("en", title));

  const entities = await getEntities(
    summaries.map((s) => s.wikibase_item),
    "labels|claims|sitelinks",
  );
  const countryIds = new Set(
    Object.values(entities)
      .map((entity) => countryId(entity))
      .filter(Boolean),
  );
  const countries = await getEntities([...countryIds], "labels");

  const result = [];
  for (const [i, site] of SITES.entries()) {
    const summary = summaries[i];
    const entity = entities[summary.wikibase_item];
    const warnings = [];
    const id = slugify(site.name?.en ?? cleanTitle(summary.title));

    const ptSummary = await getPtSummary(entity);
    if (!ptSummary) warnings.push("no pt.wikipedia article");

    const wikidataCoord = best(entity, "P625")[0]?.mainsnak.datavalue.value;
    const lat = summary.coordinates?.lat ?? wikidataCoord?.latitude;
    const lon = summary.coordinates?.lon ?? wikidataCoord?.longitude;
    if (lat === undefined) warnings.push("no coordinates");

    const country = countries[countryId(entity)];
    if (!country) warnings.push("no country");

    let image = previous.get(id)?.image ?? null;
    if (!summary.thumbnail) warnings.push("no photo");
    else if (!SKIP_IMAGES) image = await downloadImage("sites", id, summary.thumbnail);
    else if (!image) warnings.push("photo not downloaded yet");

    const entry = {
      id,
      name: site.name ?? {
        en: cleanTitle(summary.title),
        pt: cleanTitle(ptSummary?.title) ?? cleanTitle(summary.title),
      },
      country: country ? { en: label(country, "en"), pt: label(country, "pt") } : null,
      lat: lat === undefined ? null : +lat.toFixed(4),
      lon: lon === undefined ? null : +lon.toFixed(4),
      era: site.era,
      clue: site.clue,
      extract: { en: summary.extract, pt: ptSummary?.extract ?? null },
      wiki: {
        en: summary.content_urls.desktop.page,
        pt: ptSummary?.content_urls.desktop.page ?? null,
      },
      image,
    };
    merge(entry, SITE_OVERRIDES[site.title] ?? {});
    result.push(entry);

    console.log(
      `${String(i + 1).padStart(2)}. ${entry.name.en} / ${entry.name.pt}: ` +
        `${entry.lat}, ${entry.lon} — ${entry.country?.en}` +
        (warnings.length ? `   ⚠ ${warnings.join("; ")}` : ""),
    );
  }

  await writeFile(OUT_JSON, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nWrote ${result.length} sites to ${path.relative(ROOT, OUT_JSON)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
