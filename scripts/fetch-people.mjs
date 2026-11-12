// Builds games/who-when-where/data/people.json from Wikipedia + Wikidata.
//
//   node scripts/fetch-people.mjs            fetch everyone, download portraits
//   node scripts/fetch-people.mjs --no-images  skip portrait downloads
//
// The roster and manual corrections live in scripts/people-roster.mjs.
// Wikidata is the structured side of Wikipedia: birth/death dates and places
// come from there, summaries and portraits from the Wikipedia REST API.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  best,
  cleanTitle,
  countryId,
  downloadImage,
  getImageCredits,
  getEntities,
  getJson,
  label,
  merge,
  slugify,
  summaryUrl,
  stripHatnote,
} from "./lib/wiki.mjs";
import { findGiveaways, stripNationality } from "./lib/giveaways.mjs";
import { DESCRIPTIONS } from "./people-descriptions.mjs";
import { ROSTER, OVERRIDES } from "./people-roster.mjs";

const OUT_JSON = path.join(ROOT, "games/who-when-where/data/people.json");
const SKIP_IMAGES = process.argv.includes("--no-images");

function yearOf(entity, prop) {
  const statements = best(entity, prop);
  const years = [
    ...new Set(
      statements.map((s) => {
        const m = /^([+-])(\d+)-/.exec(s.mainsnak.datavalue.value.time);
        return (m[1] === "-" ? -1 : 1) * parseInt(m[2], 10);
      }),
    ),
  ];
  return { year: years[0], alternatives: years.slice(1) };
}

// Hide the answer: "English naturalist (1809–1882)" -> "English naturalist".
const stripYears = (s) =>
  s
    ?.replace(/\s*\([^)]*\d{3,4}[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The image with its credit last; without a new one, whatever it had. */
function withCredit(image, credit, warnings) {
  const { credit: before, ...rest } = image;
  if (!credit && !before) warnings.push("no image credit");
  return { ...rest, credit: credit ?? before };
}

async function main() {
  await mkdir(path.dirname(OUT_JSON), { recursive: true });

  const previous = new Map();
  try {
    for (const p of JSON.parse(await readFile(OUT_JSON, "utf8"))) previous.set(p.id, p);
  } catch {}

  console.log(`Fetching ${ROSTER.length} Wikipedia summaries…`);
  const summaries = [];
  for (const title of ROSTER) {
    summaries.push(await getJson(summaryUrl("en", title)));
  }

  // Who made each image, and under which licence (shown on the reveal).
  const credits = await getImageCredits(summaries.map((s) => s.thumbnail?.source).filter(Boolean));

  const qids = summaries.map((s) => s.wikibase_item);
  const people = await getEntities(qids, "labels|descriptions|claims|sitelinks");

  const placeIds = new Set();
  for (const qid of qids) {
    for (const prop of ["P19", "P20"]) {
      for (const s of best(people[qid], prop)) placeIds.add(s.mainsnak.datavalue.value.id);
    }
  }
  const places = await getEntities([...placeIds], "labels|claims");
  const countryIds = new Set([...placeIds].map((id) => countryId(places[id])).filter(Boolean));
  const countries = await getEntities([...countryIds], "labels");

  const describePlace = (person, prop, warnings) => {
    const statements = best(person, prop);
    if (!statements.length) {
      warnings.push(`no ${prop}`);
      return null;
    }
    if (statements.length > 1) warnings.push(`${statements.length} values for ${prop}`);
    const place = places[statements[0].mainsnak.datavalue.value.id];
    const coord = best(place, "P625")[0]?.mainsnak.datavalue.value;
    if (!coord) warnings.push(`no coordinates for ${label(place, "en")}`);
    const country = countries[countryId(place)];
    return {
      name: { en: label(place, "en"), pt: label(place, "pt") },
      country: country
        ? { en: label(country, "en"), pt: label(country, "pt") }
        : null,
      lat: coord ? +coord.latitude.toFixed(4) : null,
      lon: coord ? +coord.longitude.toFixed(4) : null,
    };
  };

  const result = [];
  for (const [i, title] of ROSTER.entries()) {
    const summary = summaries[i];
    const person = people[summary.wikibase_item];
    const warnings = [];
    const id = slugify(title);

    const born = yearOf(person, "P569");
    if (born.year < 1) warnings.push("BCE birth year: the year dial starts at 1");
    const died = yearOf(person, "P570");
    if (born.alternatives.length) warnings.push(`birth year also ${born.alternatives}`);
    if (died.alternatives.length) warnings.push(`death year also ${died.alternatives}`);

    const ptTitle = person.sitelinks?.ptwiki?.title;
    let ptSummary = null;
    if (ptTitle) {
      ptSummary = await getJson(summaryUrl("pt", ptTitle));
    } else {
      warnings.push("no pt.wikipedia article");
    }

    // With --no-images, keep whatever portrait the previous run recorded.
    let image = previous.get(id)?.image ?? null;
    if (!summary.thumbnail) warnings.push("no portrait");
    else if (!SKIP_IMAGES) {
      image = await downloadImage("people", id, summary.thumbnail);
    } else if (!image) warnings.push("portrait not downloaded yet");
    if (image && summary.thumbnail) image = withCredit(image, credits.get(summary.thumbnail.source), warnings);

    const entry = {
      id,
      qid: summary.wikibase_item,
      name: {
        en: cleanTitle(summary.title),
        pt: cleanTitle(ptSummary?.title) ?? cleanTitle(summary.title),
      },
      description: {
        en: stripYears(summary.description ?? person.descriptions?.en?.value),
        pt: stripYears(
          person.descriptions?.["pt-br"]?.value ??
            person.descriptions?.pt?.value ??
            ptSummary?.description,
        ),
      },
      extract: { en: stripHatnote(summary.extract) || summary.extract, pt: stripHatnote(ptSummary?.extract) || null },
      wiki: {
        en: summary.content_urls.desktop.page,
        pt: ptSummary?.content_urls.desktop.page ?? null,
      },
      image,
      birth: { year: born.year, place: describePlace(person, "P19", warnings) },
      death: { year: died.year, place: describePlace(person, "P20", warnings) },
    };
    merge(entry, OVERRIDES[title] ?? {});
    // The description is shown during play: no nationality or place in it
    // (scripts/people-descriptions.mjs; Wikidata's start with one).
    const written = DESCRIPTIONS[title];
    if (written) entry.description = { en: written[0], pt: written[1] };
    else {
      warnings.push("no hand-written description");
      for (const lang of ["en", "pt"]) entry.description[lang] = stripNationality(entry.description[lang], lang);
    }
    for (const lang of ["en", "pt"]) {
      const hits = findGiveaways(entry.description[lang]);
      if (hits.length) warnings.push(`description.${lang} names ${hits.map((hit) => hit.term).join(", ")}`);
    }
    result.push(entry);

    const b = entry.birth;
    const d = entry.death;
    console.log(
      `${String(i + 1).padStart(2)}. ${entry.name.en}: ` +
        `${b.year} ${b.place?.name.en}, ${b.place?.country?.en} → ` +
        `${d.year} ${d.place?.name.en}, ${d.place?.country?.en}` +
        (warnings.length ? `   ⚠ ${warnings.join("; ")}` : ""),
    );
  }

  await writeFile(OUT_JSON, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nWrote ${result.length} people to ${path.relative(ROOT, OUT_JSON)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
