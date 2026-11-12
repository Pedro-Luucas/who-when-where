// Builds games/dig-site/data/gallery.json: more photos of every Dig Site site,
// shown in a gallery once the dig is over.
//
//   node scripts/fetch-site-gallery.mjs           every site
//   node scripts/fetch-site-gallery.mjs petra     just these ids
//
// Run it after scripts/fetch-sites.mjs (it reads games/dig-site/data/sites.json
// and never writes it). For each site it gathers free photos from Wikimedia
// Commons, in this order:
//   1. the Wikidata item's image(s) (P18),
//   2. the photos used in the English, then the Portuguese Wikipedia article,
//   3. the files in the site's Commons category (Wikidata P373), featured and
//      quality images first, then its subcategories and, last of all, a
//      Commons search for the site's name.
// Only public domain, CC0, CC BY and CC BY-SA files are kept; maps, plans,
// drawings, logos, flags, small and very long images are skipped. Each photo
// is fitted inside 800×800, saved as a JPEG under public/sites/ with an opaque
// name (a file called petra-2.jpg would give the answer away) and stored with
// its credit and, when Commons has a short one, a caption.

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ROOT, creditFrom, getEntities, getJson, plain, politeFetch, setPace } from "./lib/wiki.mjs";

// Hundreds of requests to Commons: slower than the other scripts, or it rate-limits us.
setPace(1200);

const SITES_JSON = path.join(ROOT, "games/dig-site/data/sites.json");
const OUT_JSON = path.join(ROOT, "games/dig-site/data/gallery.json");
const FOLDER = "sites";
const OUT_DIR = path.join(ROOT, "public", FOLDER);

/** Extra photos per site (the main photo comes on top of these). */
const TARGET = 6;
/** Fewer than this and the script digs further (subcategories, search). */
const MIN = 4;
/** Longest side of a saved photo, and the Wikimedia thumbnail step it is cut from. */
const SIZE = 800;
const FETCH_WIDTH = 960;
const MIN_WIDTH = 600;
const QUALITY = 66;
/** At most this many photos by one author, so a site is not one person's photo series. */
const PER_AUTHOR = 2;

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const META_FIELDS = [
  "License",
  "LicenseShortName",
  "LicenseUrl",
  "UsageTerms",
  "NonFree",
  "Artist",
  "Credit",
  "ImageDescription",
  "Categories",
  "Assessments",
].join("|");

const ids = process.argv.slice(2).filter((a) => !a.startsWith("-"));

// ── Filters ─────────────────────────────────────────────────────────────────

/** File extensions worth asking about: photos, never vector art, sound or video. */
const BITMAP = /\.(jpe?g|tiff?|webp)$/i;
const MIMES = new Set(["image/jpeg", "image/tiff", "image/webp"]);

/** Names of things that are not photos of the place. */
const NOT_A_PHOTO =
  /\b(map|maps|mapa|karte|carte|plan|plans|plano|planta|grundriss|diagram|schema|scheme|layout|elevation|logo|flag|bandeira|coat[ _-]of[ _-]arms|wappen|brasão|emblem|seal|icon|locator|location|topograph\w*|drawing|zeichnung|dessin|desenho|sketch|engraving|lithograph\w*|etching|illustration|reconstruction|rekonstruktion|reconstitution|render(ing)?|3d[ _-]?model|model|stamp|coin|banknote|postcard|poster|book|page|scan|cover|chart|graph|screenshot|svg)\b/i;

/** Commons categories that mean the same. */
const NOT_A_PHOTO_CATEGORY =
  /(^|\|)\s*((location |relief |old |historical |topographic )?maps|plans|floor plans|site plans|diagrams|logos|flags|coats of arms|postage stamps|coins|banknotes|drawings|engravings|lithographs|architectural drawings|reconstructions|3d models|book covers|scanned)\b|\b(maps|plans|diagrams|drawings|engravings|reconstructions) of\b/i;

/** Free licences only: public domain, CC0, CC BY and CC BY-SA (any version). */
function isFree(meta) {
  const value = (key) => plain(meta?.[key]?.value);
  if (value("NonFree") === "true") return false;
  const code = value("License").toLowerCase();
  if (/^(pd\b|pd-|cc0|cc-zero|cc-by-(sa-)?\d(\.\d)?\b)/.test(code)) return true;
  if (code) return false;
  const name = value("LicenseShortName").toLowerCase();
  return /^(public domain|pd\b|cc0|cc by(-sa)? \d(\.\d)?\b)/.test(name);
}

/** "Some photo (cropped).jpg" and "Some_photo.jpg" are the same picture. */
const stem = (file) =>
  file
    .replace(/\.[a-z]+$/i, "")
    .replace(/[\s_]*\((cropped|crop|edit(ed)?|retouched|rotated|bright(ened)?)\)/gi, "")
    .replace(/[\s_-]+(cropped|crop|edit(ed)?|retouched)$/i, "")
    .replace(/[\s_]+/g, " ")
    .trim()
    .toLowerCase();

const SCRIPTS_WE_READ = /[\p{Script=Latin}]/u;
const LETTER = /\p{L}/gu;

/**
 * A short caption from a Commons description: plain text, no language tag,
 * one sentence, at most ~110 characters. Null when it is mostly in a script
 * the site's readers may not read, or says nothing useful.
 */
function captionOf(html, file) {
  let text = plain(html)
    .replace(/^(english|en|português|portuguese|pt)\s*:\s*/i, "")
    .replace(/\s*\b(own work|photo taken by|photographed by|taken by)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
  if (!text || (text.match(/\p{L}{2,}/gu) ?? []).length < 2) return null;
  // Wiki Loves Monuments boilerplate, camera names and the like.
  if (/^(this is a (photo|image)|photo of a monument|dsc|img|p\d{5})/i.test(text)) return null;
  if (/^[\p{L}\s-]*[\d\s_()-]{3,}$/u.test(text)) return null;
  const letters = text.match(LETTER) ?? [];
  const latin = letters.filter((ch) => SCRIPTS_WE_READ.test(ch)).length;
  if (!letters.length || latin / letters.length < 0.8) return null;
  if (stem(text) === stem(file)) return null;
  // The first sentence, if it is long enough to stand alone.
  const first = text.split(/(?<=[.!?])\s+(?=[\p{Lu}"“])/u)[0];
  if (first.length >= 20) text = first;
  text = text.replace(/[.\s]+$/, "");
  if (text.length > 110) {
    const cut = text.slice(0, 109);
    text = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).replace(/[,;:\s-]+$/, "")}…`;
  }
  return text;
}

/**
 * Captions in English and Portuguese from a description asked for in every
 * language. A description with no language tag is taken as English.
 */
function captionsOf(description, file) {
  if (!description) return null;
  const tagged = typeof description === "object";
  const en = captionOf(tagged ? description.en : description, file);
  const pt = tagged ? captionOf(description.pt ?? description["pt-br"], file) : null;
  if (!en && !pt) return null;
  return { ...(en ? { en } : {}), ...(pt ? { pt } : {}) };
}

/**
 * Asked for in every language, extmetadata values can be { en, de, …, _type }.
 * The descriptions stay that way; everything else is reduced to one string.
 */
function singleLanguage(meta) {
  const out = {};
  for (const [key, field] of Object.entries(meta ?? {})) {
    const v = field?.value;
    if (key === "ImageDescription" || !v || typeof v !== "object") out[key] = field;
    else out[key] = { ...field, value: v.en ?? Object.entries(v).find(([k]) => k !== "_type")?.[1] ?? "" };
  }
  return out;
}

// ── Sources ─────────────────────────────────────────────────────────────────

const titleOfUrl = (url) => decodeURIComponent(url.split("/wiki/")[1] ?? "").replace(/_/g, " ");

/**
 * The files each article uses and its Wikidata id, keyed by the title asked
 * for. Asks for 40 articles at a time (one-by-one parsing gets rate-limited).
 */
async function articleImages(lang, titles) {
  const out = new Map();
  const list = [...new Set(titles.filter(Boolean))];
  for (let i = 0; i < list.length; i += 40) {
    const chunk = list.slice(i, i + 40);
    const base =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1` +
      `&prop=images|pageprops&ppprop=wikibase_item&imlimit=max&titles=${encodeURIComponent(chunk.join("|"))}`;
    const pages = new Map();
    const from = new Map();
    let cont = "";
    try {
      do {
        const data = await getJson(base + cont);
        // Asked-for title → normalised title → redirect target.
        for (const n of data.query?.normalized ?? []) from.set(n.to, n.from);
        for (const r of data.query?.redirects ?? []) from.set(r.to, from.get(r.from) ?? r.from);
        for (const page of data.query?.pages ?? []) {
          const entry = pages.get(page.title) ?? { files: [], item: null };
          entry.item ??= page.pageprops?.wikibase_item ?? null;
          entry.files.push(...(page.images ?? []).map((img) => img.title.replace(/^File:/, "")));
          pages.set(page.title, entry);
        }
        cont = data.continue
          ? "&" + new URLSearchParams(Object.entries(data.continue).map(([k, v]) => [k, String(v)])).toString()
          : "";
      } while (cont);
    } catch (err) {
      console.log(`  ! ${lang} articles: ${err.message}`);
    }
    for (const [title, entry] of pages) out.set(from.get(title) ?? title, entry);
  }
  return out;
}

/** Files (or subcategories) directly in a Commons category. */
async function categoryMembers(category, type, limit) {
  const url =
    `${COMMONS_API}?action=query&format=json&formatversion=2&list=categorymembers` +
    `&cmtitle=${encodeURIComponent(`Category:${category}`)}&cmtype=${type}&cmlimit=${limit}`;
  try {
    const data = await getJson(url);
    return (data.query?.categorymembers ?? []).map((m) => m.title.replace(/^(File|Category):/, ""));
  } catch (err) {
    console.log(`  ! category "${category}": ${err.message}`);
    return [];
  }
}

async function searchFiles(query) {
  const url =
    `${COMMONS_API}?action=query&format=json&formatversion=2&list=search&srnamespace=6&srlimit=40` +
    `&srsearch=${encodeURIComponent(`${query} filetype:bitmap`)}`;
  try {
    const data = await getJson(url);
    return (data.query?.search ?? []).map((m) => m.title.replace(/^File:/, ""));
  } catch (err) {
    console.log(`  ! search "${query}": ${err.message}`);
    return [];
  }
}

/** Commons metadata for files, keyed by file name (files not on Commons are left out). */
const infoCache = new Map();
async function fileInfo(files) {
  const wanted = files.filter((f) => !infoCache.has(f));
  for (let i = 0; i < wanted.length; i += 25) {
    const chunk = wanted.slice(i, i + 25);
    const url =
      `${COMMONS_API}?action=query&format=json&formatversion=2&prop=imageinfo` +
      `&iiprop=url|size|mime|sha1|extmetadata&iiurlwidth=${FETCH_WIDTH}&iiextmetadatamultilang=1` +
      `&iiextmetadatafilter=${META_FIELDS}&titles=${encodeURIComponent(chunk.map((f) => `File:${f}`).join("|"))}`;
    const data = await getJson(url);
    const asked = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const f of chunk) infoCache.set(f, null);
    for (const page of data.query?.pages ?? []) {
      const title = (asked.get(page.title) ?? page.title).replace(/^File:/, "");
      const info = page.imageinfo?.[0];
      // A page that is "missing" is a local (often non-free) Wikipedia upload.
      if (!page.missing && info) infoCache.set(title, { ...info, extmetadata: singleLanguage(info.extmetadata), file: page.title.replace(/^File:/, "") });
    }
  }
  return files.map((f) => infoCache.get(f)).filter(Boolean);
}

// ── Choosing ────────────────────────────────────────────────────────────────

/** Why a file is not used, or null when it is a usable photo. */
function rejection(info) {
  if (!MIMES.has(info.mime)) return "not a photo format";
  if (info.width < MIN_WIDTH || info.height < 400) return "too small";
  const ratio = info.width / info.height;
  if (ratio > 2.4 || ratio < 0.5) return "panorama or strip";
  if (!isFree(info.extmetadata)) return "licence";
  if (NOT_A_PHOTO.test(info.file.replace(/[_-]/g, " "))) return "not a photo (name)";
  if (NOT_A_PHOTO_CATEGORY.test(plain(info.extmetadata?.Categories?.value))) return "not a photo (category)";
  if (!info.thumburl || /\.tiff?$/i.test(info.thumburl)) return "no thumbnail";
  return null;
}

const assessed = (info) => /featured|quality|valued|poty/i.test(plain(info.extmetadata?.Assessments?.value));
const order = (file) => createHash("sha1").update(file).digest("hex");

/** Featured and quality images first; the rest in a stable, spread-out order (not alphabetical runs). */
const rank = (infos) =>
  [...infos].sort((a, b) => Number(assessed(b)) - Number(assessed(a)) || order(a.file).localeCompare(order(b.file)));

class Picker {
  constructor(site) {
    this.picked = [];
    this.seen = new Set();
    this.stems = new Set();
    this.sha1 = new Set();
    this.authors = new Map();
    this.rejected = new Map();
    /** Good photos turned away only because their author already has PER_AUTHOR. */
    this.spare = [];
    const main = site.image?.credit?.file;
    if (main) {
      this.seen.add(main);
      this.stems.add(stem(main));
    }
  }

  get full() {
    return this.picked.length >= TARGET;
  }

  /** Tries files in the order given until the gallery is full. */
  async offer(files, { ranked = false } = {}) {
    const fresh = [...new Set(files)].filter((f) => BITMAP.test(f) && !this.seen.has(f));
    if (!fresh.length || this.full) return;
    let infos = await fileInfo(fresh);
    if (ranked) infos = rank(infos);
    for (const info of infos) {
      if (this.full) return;
      this.seen.add(info.file);
      const why = rejection(info) ?? this.duplicate(info);
      if (why) {
        this.rejected.set(why, (this.rejected.get(why) ?? 0) + 1);
        if (why === "same author") this.spare.push(info);
        continue;
      }
      this.take(info);
    }
  }

  take(info) {
    const credit = creditFrom("commons", info.file, info.extmetadata);
    this.picked.push({ info, credit });
    this.stems.add(stem(info.file));
    this.sha1.add(info.sha1);
    this.authors.set(credit.author, (this.authors.get(credit.author) ?? 0) + 1);
  }

  /** Last resort: one author's photos are better than too few. */
  useSpares() {
    for (const info of this.spare) {
      if (this.picked.length >= MIN) return;
      if (!this.sha1.has(info.sha1) && !this.stems.has(stem(info.file))) this.take(info);
    }
  }

  duplicate(info) {
    if (this.sha1.has(info.sha1) || this.stems.has(stem(info.file))) return "duplicate";
    const author = creditFrom("commons", info.file, info.extmetadata).author;
    if (author !== "Unknown author" && (this.authors.get(author) ?? 0) >= PER_AUTHOR) return "same author";
    return null;
  }
}

// ── Saving ──────────────────────────────────────────────────────────────────

const nameOf = (id, file) => createHash("sha1").update(`www:site-gallery:${id}:${file}`).digest("hex").slice(0, 12);

async function exists(file) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

/** Saves a photo fitted inside SIZE×SIZE; an existing file is kept (delete it to fetch again). */
async function save(id, info) {
  const file = `${nameOf(id, info.file)}.jpg`;
  const out = path.join(OUT_DIR, file);
  if (!(await exists(out))) {
    const res = await politeFetch(info.thumburl);
    const buffer = Buffer.from(await res.arrayBuffer());
    await sharp(buffer)
      .rotate()
      .resize({ width: SIZE, height: SIZE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toFile(out);
  }
  const meta = await sharp(out).metadata();
  return { src: `/${FOLDER}/${file}`, width: meta.width, height: meta.height };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const sites = JSON.parse(await readFile(SITES_JSON, "utf8")).filter(
    (s) => s.image && s.lat !== null && (!ids.length || ids.includes(s.id)),
  );

  let previous = {};
  try {
    previous = JSON.parse(await readFile(OUT_JSON, "utf8"));
  } catch {}

  // Wikidata items of the English articles, for P18, P373 and the Portuguese article.
  const none = { files: [], item: null };
  const enArticles = await articleImages("en", sites.map((s) => titleOfUrl(s.wiki.en)));
  const articles = new Map(sites.map((s) => [s.id, enArticles.get(titleOfUrl(s.wiki.en)) ?? none]));
  const entities = await getEntities(
    [...new Set([...articles.values()].map((a) => a.item).filter(Boolean))],
    "claims|sitelinks",
  );
  const ptTitleOf = (site) => {
    const entity = entities[articles.get(site.id).item];
    return entity?.sitelinks?.ptwiki?.title ?? (site.wiki.pt ? titleOfUrl(site.wiki.pt) : null);
  };
  const ptArticles = await articleImages("pt", sites.map(ptTitleOf));

  const gallery = ids.length ? { ...previous } : {};
  /** Picks and saves one site's photos. Throws when Wikimedia keeps refusing (unless `tolerant`). */
  async function photosFor(site, tolerant) {
    const article = articles.get(site.id);
    const entity = entities[article.item] ?? {};
    const claim = (prop) =>
      (entity.claims?.[prop] ?? [])
        .filter((s) => s.rank !== "deprecated" && s.mainsnak.snaktype === "value")
        .map((s) => s.mainsnak.datavalue.value);
    const picker = new Picker(site);

    await picker.offer(claim("P18"));
    await picker.offer(article.files, { ranked: true });
    if (!picker.full) await picker.offer((ptArticles.get(ptTitleOf(site)) ?? none).files, { ranked: true });

    const commonsLink = entity.sitelinks?.commonswiki?.title;
    const category =
      claim("P373")[0] ?? (commonsLink?.startsWith("Category:") ? commonsLink.slice("Category:".length) : null);
    if (!picker.full && category) await picker.offer(await categoryMembers(category, "file", 200), { ranked: true });

    // Still short: the category's subcategories (not its maps or people), then a search.
    if (picker.picked.length < MIN && category) {
      const subcats = (await categoryMembers(category, "subcat", 50)).filter(
        (c) => !/\b(maps?|plans?|people|logos?|flags?|drawings?|videos?|audio|sounds?|documents?|books?|stamps?|coins?)\b/i.test(c),
      );
      for (const sub of subcats.slice(0, 8)) {
        if (picker.picked.length >= MIN) break;
        await picker.offer(await categoryMembers(sub, "file", 100), { ranked: true });
      }
    }
    if (picker.picked.length < MIN) await picker.offer(await searchFiles(`"${site.name.en}"`), { ranked: true });
    picker.useSpares();

    const images = [];
    for (const { info, credit } of picker.picked) {
      try {
        const saved = await save(site.id, info);
        const caption = captionsOf(info.extmetadata?.ImageDescription?.value, info.file);
        images.push({ ...saved, credit, ...(caption ? { caption } : {}) });
      } catch (err) {
        if (!tolerant) throw err;
        console.log(`  ! ${info.file}: ${err.message}`);
      }
    }
    return { images, picker };
  }

  for (const [n, site] of sites.entries()) {
    let result;
    // Rate limits come and go: wait and try the site again (photos already saved are kept).
    for (let attempt = 1; !result; attempt++) {
      try {
        result = await photosFor(site, attempt >= 4);
      } catch (err) {
        if (attempt >= 6) throw err;
        console.log(`  ! ${site.id}: ${err.message}; trying again in 90s`);
        await new Promise((r) => setTimeout(r, 90_000));
      }
    }
    const { images, picker } = result;
    gallery[site.id] = images;

    const skipped = [...picker.rejected].map(([why, k]) => `${why} ×${k}`).join(", ");
    console.log(
      `${String(n + 1).padStart(2)}. ${site.id}: ${images.length}` +
        (images.length < MIN ? "   ⚠ under " + MIN : "") +
        (skipped ? `   (skipped: ${skipped})` : ""),
    );
  }

  // Keep the file in roster order, then drop gallery photos nothing points at any more.
  const ordered = {};
  for (const s of JSON.parse(await readFile(SITES_JSON, "utf8"))) if (gallery[s.id]) ordered[s.id] = gallery[s.id];
  await writeFile(OUT_JSON, JSON.stringify(ordered, null, 2) + "\n");

  const used = new Set(Object.values(ordered).flatMap((list) => list.map((img) => path.basename(img.src))));
  const before = new Set(Object.values(previous).flatMap((list) => list.map((img) => path.basename(img.src))));
  for (const file of await readdir(OUT_DIR)) {
    if (before.has(file) && !used.has(file)) await unlink(path.join(OUT_DIR, file));
  }

  let bytes = 0;
  for (const file of used) bytes += (await stat(path.join(OUT_DIR, file))).size;
  const all = Object.values(ordered).map((list) => list.length);
  const short = Object.entries(ordered).filter(([, list]) => list.length < MIN);
  console.log(
    `\nWrote ${path.relative(ROOT, OUT_JSON)}: ${all.length} sites, ${used.size} photos, ` +
      `${(bytes / 1024 / 1024).toFixed(1)} MB. Per site: min ${Math.min(...all)}, ` +
      `avg ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(1)}, max ${Math.max(...all)}.`,
  );
  if (short.length) console.log(`Under ${MIN}: ${short.map(([id, list]) => `${id} (${list.length})`).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
