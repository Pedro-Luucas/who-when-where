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

// Wikipedia summaries can open with a hatnote ("This article is about X. For Y, see Z.")
// that reads as if it were part of the text, and can name the answer. Drop those sentences
// (an extract that was nothing else comes back empty).
const HATNOTE =
  /^(This article is (about|on)|This page is about|For (other|the|more)\b|Not to be confused|See also|Este artigo (é|trata)|Esta página (é|trata)|Para (outros|o |a |os |as |mais)|Não confundir|Veja também)/i;

export function stripHatnote(text) {
  if (!text) return text;
  const sentences = text.split(/(?<=[.!?])\s+(?=[\p{Lu}"“])/u);
  while (sentences.length > 0 && HATNOTE.test(sentences[0])) sentences.shift();
  return sentences.join(" ");
}

/**
 * Saves a Wikipedia summary thumbnail under public/<folder>/<id>.<ext> and
 * returns what next/image needs. Wikimedia serves thumbnails in fixed width
 * steps; 500px is one of them.
 */
export async function downloadImage(folder, id, thumb, { hidden = false } = {}) {
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
  // A hidden image gets an opaque name: a file called petra.jpg gives the answer away.
  const name = hidden ? createHash("sha1").update(`www:site-image:${id}`).digest("hex").slice(0, 12) : id;
  const file = `${name}.${ext}`;
  await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
  return {
    src: `/${folder}/${file}`,
    width,
    height: Math.round((thumb.height / thumb.width) * width),
  };
}

// ── Image credits ───────────────────────────────────────────────────────────
// Every photo and portrait is a file on Wikimedia Commons (or, rarely, on a
// Wikipedia), each under its own licence. A credit names the file, its author,
// its licence and where it lives, so the game can show them on the reveal.

/**
 * The wiki and file name an upload.wikimedia.org URL points at:
 * ".../wikipedia/commons/thumb/a/ab/Some_file.jpg/500px-Some_file.jpg"
 * → { wiki: "commons", file: "Some file.jpg" }.
 */
export function imageFileOf(url) {
  const m = /\/wikipedia\/([a-z-]+)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/.exec(url ?? "");
  if (!m) return null;
  return { wiki: m[1], file: decodeURIComponent(m[2]).replace(/_/g, " ") };
}

const apiOf = (wiki) =>
  wiki === "commons" ? "https://commons.wikimedia.org/w/api.php" : `https://${wiki}.wikipedia.org/w/api.php`;

const pageOf = (wiki, file) =>
  `${wiki === "commons" ? "https://commons.wikimedia.org" : `https://${wiki}.wikipedia.org`}/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

/** Text of an extmetadata value: tags and entities out, spaces tidied. */
function plain(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text, max = 80) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function creditFrom(wiki, file, meta) {
  const value = (key) => meta?.[key]?.value;
  // A crop credits the file it was cut from first: "Original.jpg : Name" → "Name".
  let author = (plain(value("Artist")) || plain(value("Credit")))
    .replace(/^.*?\.(jpe?g|png|tiff?|gif|svg|webp)\s*:\s*/i, "")
    .replace(/^derivative work:?\s*/i, "")
    .replace(/\s*derivative work.*$/i, "")
    .replace(/\[\s*\d+\s*\]|\(\s*talk\s*\)|\(Life time:[^)]*\)|https?:\/\/\S+|Template:/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!author || /^unknown\b/i.test(author)) author = "Unknown author";
  const licence = plain(value("LicenseShortName")) || plain(value("UsageTerms")) || "See source";
  const licenceUrl = value("LicenseUrl") ? String(value("LicenseUrl")).replace(/^\/\//, "https://") : null;
  return { file, author: shorten(author), licence, licenceUrl, source: pageOf(wiki, file) };
}

/**
 * Credits for image URLs (Wikipedia summary thumbnails), keyed by URL. Asks
 * each wiki for 50 files at a time; answers are cached like every other call.
 */
export async function getImageCredits(urls) {
  const wanted = new Map();
  for (const url of urls) {
    const found = imageFileOf(url);
    if (found) wanted.set(url, found);
  }
  const byWiki = new Map();
  for (const { wiki, file } of wanted.values()) {
    if (!byWiki.has(wiki)) byWiki.set(wiki, new Set());
    byWiki.get(wiki).add(file);
  }
  const meta = new Map();
  for (const [wiki, files] of byWiki) {
    const list = [...files].sort();
    for (let i = 0; i < list.length; i += 50) {
      const titles = list.slice(i, i + 50).map((file) => `File:${file}`);
      const url =
        `${apiOf(wiki)}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=extmetadata` +
        `&titles=${encodeURIComponent(titles.join("|"))}`;
      const data = await getJson(url);
      // Titles come back normalised; map them to the names that were asked for.
      const asked = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
      for (const page of data.query?.pages ?? []) {
        const title = asked.get(page.title) ?? page.title;
        if (page.imageinfo?.[0]) meta.set(`${wiki}:${title.replace(/^File:/, "")}`, page.imageinfo[0].extmetadata);
      }
    }
  }
  const credits = new Map();
  for (const [url, { wiki, file }] of wanted) {
    const found = meta.get(`${wiki}:${file}`);
    if (found) credits.set(url, creditFrom(wiki, file, found));
  }
  return credits;
}
