// Builds games/who-when-where/data/people.json from Wikipedia + Wikidata.
//
//   node scripts/fetch-people.mjs            fetch everyone, download portraits
//   node scripts/fetch-people.mjs --no-images  skip portrait downloads
//
// The roster and manual corrections live in scripts/people-roster.mjs.
// Wikidata is the structured side of Wikipedia: birth/death dates and places
// come from there, summaries and portraits from the Wikipedia REST API.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROSTER, OVERRIDES } from "./people-roster.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = path.join(ROOT, "games/who-when-where/data/people.json");
const OUT_IMAGES = path.join(ROOT, "public/people");
const CACHE_DIR = path.join(ROOT, "scripts/.cache");
const PACE_MS = 350;
const SKIP_IMAGES = process.argv.includes("--no-images");
const HEADERS = { "User-Agent": "daily-geo-game-data-fetch/0.1 (nodejs)" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polite fetch: paced, retries on 429/5xx honouring Retry-After.
async function politeFetch(url, attempt = 1) {
  await sleep(PACE_MS);
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 6) throw new Error(`${res.status} for ${url}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Math.min(Math.max(retryAfter * 1000 || 0, 4000 * attempt), 60000);
    console.log(`  ${res.status}, waiting ${Math.round(wait / 1000)}s…`);
    await sleep(wait);
    return politeFetch(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
}

// JSON responses are cached on disk so reruns don't hit the APIs again.
// Delete scripts/.cache to force a refresh.
async function getJson(url) {
  const file = path.join(CACHE_DIR, createHash("sha1").update(url).digest("hex") + ".json");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {}
  const data = await (await politeFetch(url)).json();
  await writeFile(file, JSON.stringify(data));
  return data;
}

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const summaryUrl = (lang, title) =>
  `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}?redirect=true`;

async function getEntities(ids, props) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url =
      "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json" +
      `&ids=${chunk.join("|")}&props=${props}&languages=en|pt|pt-br|mul`;
    const data = await getJson(url);
    Object.assign(out, data.entities);
  }
  return out;
}

// Best statements for a property: preferred rank if any, else normal rank.
function best(entity, prop) {
  const all = (entity.claims?.[prop] ?? []).filter(
    (s) => s.rank !== "deprecated" && s.mainsnak.snaktype === "value",
  );
  const preferred = all.filter((s) => s.rank === "preferred");
  return preferred.length ? preferred : all;
}

// "mul" is Wikidata's language-neutral default label (common for proper names).
const label = (entity, lang) => {
  const l = entity.labels ?? {};
  const en = l.en?.value ?? l.mul?.value;
  return lang === "pt" ? (l["pt-br"]?.value ?? l.pt?.value ?? en) : en;
};

// Article titles make better display names than Wikidata labels
// ("Baruch Spinoza" rather than "Benedictus de Spinoza").
const cleanTitle = (t) => t?.replace(/\s*\([^)]*\)\s*$/, "");

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

// Current country of a place: skip statements that carry an end date.
function countryId(place) {
  const current = best(place, "P17").filter((s) => !s.qualifiers?.P582);
  const pick = current[0] ?? best(place, "P17")[0];
  return pick?.mainsnak.datavalue.value.id;
}

// Hide the answer: "English naturalist (1809–1882)" -> "English naturalist".
const stripYears = (s) =>
  s
    ?.replace(/\s*\([^)]*\d{3,4}[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

const merge = (base, patch) => {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k]) {
      merge(base[k], v);
    } else {
      base[k] = v;
    }
  }
  return base;
};

async function downloadPortrait(id, thumb) {
  // Wikimedia serves thumbnails in fixed width steps; 500px is one of them.
  const wanted = thumb.source.replace(/\/\d+px-/, "/500px-");
  let width = 500;
  let res;
  try {
    res = await politeFetch(wanted);
  } catch {
    res = await politeFetch(thumb.source);
    width = thumb.width;
  }
  const type = res.headers.get("content-type") ?? "";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const file = `${id}.${ext}`;
  await writeFile(path.join(OUT_IMAGES, file), Buffer.from(await res.arrayBuffer()));
  return {
    src: `/people/${file}`,
    width,
    height: Math.round((thumb.height / thumb.width) * width),
  };
}

async function main() {
  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await mkdir(OUT_IMAGES, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  const previous = new Map();
  try {
    for (const p of JSON.parse(await readFile(OUT_JSON, "utf8"))) previous.set(p.id, p);
  } catch {}

  console.log(`Fetching ${ROSTER.length} Wikipedia summaries…`);
  const summaries = [];
  for (const title of ROSTER) {
    summaries.push(await getJson(summaryUrl("en", title)));
  }

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
      image = await downloadPortrait(id, summary.thumbnail);
    } else if (!image) warnings.push("portrait not downloaded yet");

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
      extract: { en: summary.extract, pt: ptSummary?.extract ?? null },
      wiki: {
        en: summary.content_urls.desktop.page,
        pt: ptSummary?.content_urls.desktop.page ?? null,
      },
      image,
      birth: { year: born.year, place: describePlace(person, "P19", warnings) },
      death: { year: died.year, place: describePlace(person, "P20", warnings) },
    };
    merge(entry, OVERRIDES[title] ?? {});
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
