// Builds lib/data/notables.json — the people the people games are played
// with (Lifelines, Clue Ladder, Born Here, Could They Have Met?) — from
// Wikidata (CC0) alone: no Wikipedia text, no images.
//
//   npm run data:notables
//
// The roster lives in scripts/notables-roster.mjs. Responses are cached in
// scripts/.cache, so a rerun costs nothing; delete the cache to refresh.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, best, cleanTitle, countryId, getEntities, getJson, label, slugify } from "./lib/wiki.mjs";
import { findGiveaways, stripNationality } from "./lib/giveaways.mjs";
import { ROSTER } from "./notables-roster.mjs";

const OUT_JSON = path.join(ROOT, "lib/data/notables.json");
const PEOPLE_JSON = path.join(ROOT, "games/who-when-where/data/people.json");
const PROPS = "labels|descriptions|claims|sitelinks";
const LANGS = "en|pt|pt-br|mul";

const MALE = "Q6581097";
const FEMALE = "Q6581072";

const titleKey = (title) => title.replace(/_/g, " ").trim().toLowerCase();

/** Roster titles → Wikidata items, through the English Wikipedia sitelinks (redirects followed). */
async function resolveTitles(titles) {
  const found = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const url =
      "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&sites=enwiki&redirects=yes" +
      `&titles=${chunk.map(encodeURIComponent).join("|")}&props=${PROPS}&languages=${LANGS}`;
    const data = await getJson(url);
    for (const entity of Object.values(data.entities ?? {})) {
      const title = entity.sitelinks?.enwiki?.title;
      if (title && !("missing" in entity)) found.set(titleKey(title), entity);
    }
  }

  // A title that was a redirect comes back under the article's own title:
  // ask Wikipedia where each of those leads.
  const unmatched = titles.filter((title) => !found.has(titleKey(title)));
  const out = new Map();
  for (const title of titles) if (found.has(titleKey(title))) out.set(title, found.get(titleKey(title)));
  for (let i = 0; i < unmatched.length; i += 50) {
    const chunk = unmatched.slice(i, i + 50);
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item" +
      `&titles=${chunk.map(encodeURIComponent).join("|")}`;
    const data = await getJson(url);
    const renamed = new Map();
    for (const step of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) renamed.set(step.from, step.to);
    const qids = new Map(Object.values(data.query?.pages ?? {}).map((page) => [page.title, page.pageprops?.wikibase_item]));
    const wanted = [];
    for (const title of chunk) {
      let at = title;
      for (let hops = 0; renamed.has(at) && hops < 3; hops++) at = renamed.get(at);
      const qid = qids.get(at);
      if (qid) wanted.push([title, qid]);
    }
    const entities = await getEntities(
      wanted.map(([, qid]) => qid),
      PROPS,
    );
    for (const [title, qid] of wanted) if (entities[qid]) out.set(title, entities[qid]);
  }
  return out;
}

/** The year of a date property, historical numbering (no year 0: "-0044" is 44 BC). Null unless precise to the year. */
function yearOf(entity, prop) {
  for (const statement of best(entity, prop)) {
    const value = statement.mainsnak.datavalue?.value;
    if (!value || value.precision < 9) continue;
    const match = /^([+-])(\d+)-/.exec(value.time);
    if (match) return (match[1] === "-" ? -1 : 1) * parseInt(match[2], 10);
  }
  return null;
}

const firstId = (entity, prop) => best(entity, prop)[0]?.mainsnak.datavalue?.value?.id ?? null;

const localized = (entity) => (entity ? { en: label(entity, "en"), pt: label(entity, "pt") } : null);

// "English naturalist (1809–1882)" → "English naturalist".
const stripYears = (text) =>
  text
    ?.replace(/\s*\([^)]*\d{3,4}[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim() || null;

/** Whether a description gives the name away: any word of three letters or more from it. */
function namesThem(description, name) {
  const fold = (text) =>
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
  const text = fold(description);
  // "Pedro II of Brazil": the words after "of" name a place, not the person.
  return fold(name)
    .split(/[^a-z0-9]+/)
    .filter((_, i, all) => !["of", "do", "da", "de"].includes(all[i - 1] ?? ""))
    .filter((word) => word.length >= 3 && !["the", "von", "van", "der", "del", "los", "las"].includes(word))
    .some((word) => new RegExp(`\\b${word}\\b`).test(text));
}

const BUILDING =
  /\b(hospital|maternity|clinic|house|palace|castle|château|manor|estate|farm|fazenda|hotel|theatre|street|abbey|camp|ospedale|sanatorium|centre|center|site|home)\b/i;

/** A place too small or too vague to show: a building, or one without coordinates or a country. */
const needsParent = (place) =>
  !best(place, "P625").length || !countryId(place) || BUILDING.test(label(place, "en") ?? "");

const wikiUrl = (lang, title) =>
  title ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : null;

const round = (n) => Math.round(n * 100) / 100;

/** Occupations Wikidata only labels in English. */
const FIELD_PT = {
  cytogeneticist: "citogeneticista",
  "jazz singer": "cantor de jazz",
  "female crusader": "cruzada",
};

/** Where no occupation will do (none given, or every one names a culture), by Wikidata id. */
const FIELDS = {
  Q467650: { en: "queen", pt: "rainha" }, // Nzinga of Ndongo and Matamba
  Q171977: { en: "military leader", pt: "líder militar" }, // Tokugawa Ieyasu (samurai)
  Q44741: { en: "explorer", pt: "explorador" }, // Francisco Pizarro (conquistador)
  Q7326: { en: "explorer", pt: "explorador" }, // Hernán Cortés (conquistador)
};
const GENERIC_FIELD = { en: "historical figure", pt: "figura histórica" };

/** Wikidata descriptions that describe the item, not the person. */
const JUNK = /descrit[oa] no projeto|described (in|by) the project/i;

async function main() {
  // Who When Where's people keep their ids, so the two rosters agree, and
  // their hand-checked places (scripts/people-roster.mjs).
  const known = new Map();
  try {
    for (const person of JSON.parse(await readFile(PEOPLE_JSON, "utf8"))) known.set(person.qid, person);
  } catch {}
  const curated = (place) => place && { ...place, lat: round(place.lat), lon: round(place.lon) };

  console.log(`Resolving ${ROSTER.length} titles…`);
  const people = await resolveTitles(ROSTER);
  const dropped = [];
  for (const title of ROSTER) if (!people.has(title)) dropped.push(`${title}: no Wikidata item`);

  // Birth and death places. Where Wikidata names a building (a hospital, a
  // palace, a farm) or a place with no coordinates, the place it lies in is
  // used instead, up to three levels up.
  const places = {};
  let wanted = new Set();
  for (const person of people.values()) {
    for (const prop of ["P19", "P20"]) {
      const id = firstId(person, prop);
      if (id) wanted.add(id);
    }
  }
  for (let level = 0; level < 4 && wanted.size; level++) {
    Object.assign(places, await getEntities([...wanted], "labels|claims"));
    wanted = new Set();
    for (const place of Object.values(places)) {
      const parent = firstId(place, "P131");
      if (needsParent(place) && parent && !places[parent]) wanted.add(parent);
    }
  }

  /** The places from the one named up to the first that will do, the one named first. */
  const chainOf = (id) => {
    const chain = [];
    for (let place = places[id]; place && chain.length < 4; place = places[firstId(place, "P131")]) {
      chain.push(place);
      if (!needsParent(place)) break;
    }
    return chain;
  };

  // Countries, occupations, citizenships and works: labels only.
  const labelIds = new Set();
  for (const place of Object.values(places)) {
    const country = countryId(place);
    if (country) labelIds.add(country);
  }
  for (const person of people.values()) {
    for (const prop of ["P27", "P800"]) {
      const id = firstId(person, prop);
      if (id) labelIds.add(id);
    }
    for (const statement of best(person, "P106")) {
      const id = statement.mainsnak.datavalue?.value?.id;
      if (id) labelIds.add(id);
    }
  }
  const labelled = await getEntities([...labelIds], "labels");

  const placeOf = (person, prop) => {
    const chain = chainOf(firstId(person, prop));
    const place = chain.findLast((entry) => best(entry, "P625").length) ?? null;
    if (!place) return null;
    const coord = best(place, "P625")[0].mainsnak.datavalue.value;
    const country = labelled[chain.map(countryId).find(Boolean)];
    return {
      name: localized(place),
      country: country ? localized(country) : null,
      lat: round(coord.latitude),
      lon: round(coord.longitude),
    };
  };

  /** The occupation the description leads with ("writer" in "Brazilian writer, poet…"), else the first given. */
  const fieldOf = (person) => {
    const fields = best(person, "P106")
      .map((statement) => labelled[statement.mainsnak.datavalue?.value?.id])
      .filter(Boolean)
      .map(localized)
      .filter((field) => field.en)
      .map((field) => ({ ...field, pt: field.pt === field.en ? (FIELD_PT[field.en] ?? field.pt) : field.pt }))
      // "samurai" or "conquistador" says where as much as what.
      .filter((field) => !findGiveaways(field.en).length && !findGiveaways(field.pt).length);
    if (FIELDS[person.id]) return FIELDS[person.id];
    const description = (person.descriptions?.en?.value ?? "").toLowerCase();
    const at = (field) => {
      const found = description.indexOf(field.en.toLowerCase());
      return found === -1 ? Infinity : found;
    };
    return fields.reduce((chosen, field) => (at(field) < at(chosen) ? field : chosen), fields[0]) ?? GENERIC_FIELD;
  };

  const result = [];
  const ids = new Set();
  for (const title of ROSTER) {
    const person = people.get(title);
    if (!person) continue;
    const enTitle = cleanTitle(person.sitelinks.enwiki.title);
    const ptTitle = person.sitelinks.ptwiki?.title ?? null;
    const name = { en: enTitle, pt: cleanTitle(ptTitle) ?? enTitle };

    const bornYear = yearOf(person, "P569");
    const diedYear = yearOf(person, "P570");
    const checked = known.get(person.id);
    const bornPlace = curated(checked?.birth.place) ?? placeOf(person, "P19");
    if (bornYear === null || diedYear === null || !bornPlace) {
      const missing = [bornYear === null && "birth year", diedYear === null && "death year", !bornPlace && "birthplace"];
      dropped.push(`${title}: no ${missing.filter(Boolean).join(", ")}`);
      continue;
    }

    const field = fieldOf(person);
    const describe = (lang) => {
      const text = stripYears(
        lang === "pt"
          ? (person.descriptions?.["pt-br"]?.value ?? person.descriptions?.pt?.value)
          : person.descriptions?.en?.value,
      );
      // Dates and names give the answer away: the occupation says less.
      if (!text || JUNK.test(text) || namesThem(text, `${name.en} ${name.pt}`) || /\d{2,}(?!\d*(st|nd|rd|th)\b)/.test(text)) {
        return field?.[lang] ?? null;
      }
      // So do nationalities and places ("Dutch seafarer", "rei da Macedônia"): strip
      // them, and where something is still left that names a place, fall back too.
      const plain = stripNationality(text, lang);
      // A lone word ("Leader") says less than the field ("military leader").
      if (!plain || !/\s/.test(plain) || findGiveaways(plain).length) return field?.[lang] ?? null;
      return plain;
    };
    /** A notable work, unless its title names the person or a place ("Noether's theorem", "The History of Mexico"). */
    const telling = (title) => !title || namesThem(title, `${name.en} ${name.pt}`) || findGiveaways(title).length > 0;
    const workOf = (entity) => {
      const work = entity ? localized(entity) : null;
      return work && !telling(work.en) && !telling(work.pt) ? work : null;
    };

    let id = checked?.id ?? slugify(enTitle);
    if (ids.has(id)) id = `${id}-${person.id.toLowerCase()}`;
    ids.add(id);

    const sex = person.claims?.P21 ? firstId(person, "P21") : null;
    const citizenship = labelled[firstId(person, "P27")];
    const work = workOf(labelled[firstId(person, "P800")]);
    result.push({
      id,
      qid: person.id,
      name,
      description: { en: describe("en") ?? "", pt: describe("pt") ?? describe("en") ?? "" },
      field: field ?? { en: "", pt: "" },
      sex: sex === MALE ? "m" : sex === FEMALE ? "f" : null,
      born: { year: bornYear, place: bornPlace },
      died: { year: diedYear, place: curated(checked?.death.place) ?? placeOf(person, "P20") },
      citizenship: citizenship ? localized(citizenship) : null,
      work,
      // A name that names a place or a people (Joan of Arc, Julius Caesar) is no clue to show for someone else.
      placeInName: findGiveaways(name.en).length + findGiveaways(name.pt).length > 0,
      wiki: { en: wikiUrl("en", person.sitelinks.enwiki.title), pt: wikiUrl("pt", ptTitle) },
      fame: Object.keys(person.sitelinks ?? {}).filter((site) => /^[a-z_]+wiki$/.test(site) && site !== "commonswiki" && site !== "specieswiki").length,
    });
  }

  result.sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(OUT_JSON, `[\n${result.map((entry) => JSON.stringify(entry)).join(",\n")}\n]\n`);

  for (const line of dropped) console.log(`  dropped ${line}`);
  console.log(`\nWrote ${result.length} people to ${path.relative(ROOT, OUT_JSON)} (${dropped.length} dropped)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
