// Shared helpers for the data scripts: polite, cached access to the Wikipedia
// REST API and Wikidata, plus image downloads from Wikimedia Commons.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE_DIR = path.join(ROOT, "scripts/.cache");
const PACE_MS = 350;
const HEADERS = { "User-Agent": "daily-geo-game-data-fetch/0.1 (nodejs)" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polite fetch: paced, retries on 429/5xx honouring Retry-After.
export async function politeFetch(url, attempt = 1) {
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
export async function getJson(url) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, createHash("sha1").update(url).digest("hex") + ".json");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {}
  const data = await (await politeFetch(url)).json();
  await writeFile(file, JSON.stringify(data));
  return data;
}

export const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const summaryUrl = (lang, title) =>
  `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}?redirect=true`;

export const getSummary = (lang, title) => getJson(summaryUrl(lang, title));

export async function getEntities(ids, props) {
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
export function best(entity, prop) {
  const all = (entity.claims?.[prop] ?? []).filter(
    (s) => s.rank !== "deprecated" && s.mainsnak.snaktype === "value",
  );
  const preferred = all.filter((s) => s.rank === "preferred");
  return preferred.length ? preferred : all;
}

// "mul" is Wikidata's language-neutral default label (common for proper names).
export const label = (entity, lang) => {
  const l = entity.labels ?? {};
  const en = l.en?.value ?? l.mul?.value;
  return lang === "pt" ? (l["pt-br"]?.value ?? l.pt?.value ?? en) : en;
};

// Article titles make better display names than Wikidata labels
// ("Baruch Spinoza" rather than "Benedictus de Spinoza").
export const cleanTitle = (t) => t?.replace(/\s*\([^)]*\)\s*$/, "");

// Current country of a place: skip statements that carry an end date.
export function countryId(place) {
  const current = best(place, "P17").filter((s) => !s.qualifiers?.P582);
  const pick = current[0] ?? best(place, "P17")[0];
  return pick?.mainsnak.datavalue.value.id;
}

export const merge = (base, patch) => {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k]) {
      merge(base[k], v);
    } else {
      base[k] = v;
    }
  }
  return base;
};

/**
 * The Portuguese summary of an article, found through its Wikidata sitelink.
 * `entity` is the Wikidata entity fetched with the "sitelinks" prop.
 */
export async function getPtSummary(entity) {
  const title = entity?.sitelinks?.ptwiki?.title;
  return title ? getSummary("pt", title) : null;
}

/**
 * Saves a Wikipedia summary thumbnail under public/<folder>/<id>.<ext> and
 * returns what next/image needs. Wikimedia serves thumbnails in fixed width
 * steps; 500px is one of them.
 */
export async function downloadImage(folder, id, thumb) {
  const dir = path.join(ROOT, "public", folder);
  await mkdir(dir, { recursive: true });
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
  await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
  return {
    src: `/${folder}/${file}`,
    width,
    height: Math.round((thumb.height / thumb.width) * width),
  };
}
