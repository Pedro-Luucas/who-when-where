// Fails when a text a player reads before the answer names a place: a country,
// a nationality, a people, an empire or kingdom, a region, sea or river, a big
// city, or a ruler or god tied to one place ("químico francês", "Herod's
// fortress … against Rome"). Run it after changing a roster or a generator:
//
//   npm run check:text
//
// What it reads (both languages):
//   Who When Where   each person's description
//   people games     each notable's description, field and notable work (Lifelines, Born Here,
//                    Could They Have Met? and Clue Ladder show them), and every Clue Ladder clue
//                    as the game builds it, except the last (initials and dates)
//   Dig Site         each site's clue and era, which must not name any site either
//   Wayfarer         the stop names shown on the map during play, which must not name the journey
//   every game       the interface texts in games/*/messages.ts
//
// What it leaves alone, on purpose: event names in First to Last, Earlier or Later
// and Same Year ("Fall of the Berlin Wall") — the event is what the player is
// asked about and its place is on the map; the year is the answer and the
// script that builds them already keeps years out. Likewise country, city and
// flag names that are themselves the question (Click the Country, Pin the City,
// Higher or Lower…). Texts shown only after the answer (Wikipedia extracts,
// captions, credits) may name anything.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createJiti } from "jiti";
import { findGiveaways } from "./lib/giveaways.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": ROOT }, interopDefault: true });
const load = (file) => jiti(path.join(ROOT, file));
const json = async (file) => JSON.parse(await readFile(path.join(ROOT, file), "utf8"));

const LOCALES = ["en", "pt"];
const problems = [];
let checked = 0;

/** Every place word in `text`, reported under `where`. */
function check(where, text, extra = []) {
  if (!text) return;
  checked++;
  const hits = [...findGiveaways(text), ...extra.filter((term) => contains(text, term)).map((term) => ({ term, kind: "answer" }))];
  if (hits.length) problems.push({ where, text, hits });
}

const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** Whether `text` has `term` as a whole word or phrase, ignoring case and accents. */
const contains = (text, term) => new RegExp(`(?<![\\p{L}\\p{N}])${fold(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(fold(text));

/** The words of a name worth matching on: "Machu Picchu" → ["Machu", "Picchu"]. */
const SMALL = new Set(["the", "of", "and", "de", "da", "do", "das", "dos", "e", "la", "le", "el", "von", "van", "der", "del", "di", "great", "grande", "old", "new", "city", "cidade", "ancient", "antiga", "antigo"]);
const nameWords = (...names) =>
  [...new Set(names.filter(Boolean).flatMap((name) => name.split(/[\s,–—()'’-]+/)))].filter(
    (word) => word.length >= 4 && !SMALL.has(word.toLowerCase()),
  );

async function main() {
  // ── Who When Where ──
  const people = await json("games/who-when-where/data/people.json");
  for (const person of people) {
    for (const lang of LOCALES) {
      check(`who-when-where ${person.id} description.${lang}`, person.description[lang], nameWords(person.name.en, person.name.pt));
    }
  }

  // ── The people games ──
  const notables = await json("lib/data/notables.json");
  for (const person of notables) {
    for (const lang of LOCALES) {
      check(`notables ${person.id} description.${lang}`, person.description[lang]);
      check(`notables ${person.id} field.${lang}`, person.field[lang]);
      if (person.work) check(`notables ${person.id} work.${lang}`, person.work[lang]);
    }
  }
  const ladder = load("games/clue-ladder/data.ts");
  for (const person of ladder.PLAYABLE) {
    for (const lang of LOCALES) {
      const clues = ladder.cluesOf(person, lang, "");
      for (const clue of clues.slice(0, -1)) check(`clue-ladder ${person.id} ${clue.key}.${lang}`, clue.text);
    }
  }
  const bornHere = load("games/born-here/data.ts");
  for (const person of bornHere.PLAYABLE) {
    const place = person.born.place.name;
    for (const lang of LOCALES) {
      if (nameWords(place.en, place.pt).some((word) => contains(person.name[lang], word))) {
        problems.push({ where: `born-here ${person.id} name.${lang}`, text: person.name[lang], hits: [{ term: place[lang], kind: "answer" }] });
      }
    }
  }

  // ── Dig Site ──
  const sites = await json("games/dig-site/data/sites.json");
  // A clue may not name its own site, not even in part ("lost city" for Ciudad Perdida),
  // nor any other site in full.
  const fullNames = sites.flatMap((site) => [site.name.en, site.name.pt]);
  for (const site of sites) {
    const own = [...nameWords(site.name.en, site.name.pt), ...fullNames];
    for (const lang of LOCALES) {
      check(`dig-site ${site.id} clue.${lang}`, site.clue[lang], own);
      check(`dig-site ${site.id} era.${lang}`, site.era[lang], own);
    }
  }

  // ── Wayfarer ──
  const { JOURNEYS, stopLabelInPlay, telltaleWords } = load("games/wayfarer/journeys.ts");
  for (const journey of JOURNEYS) {
    const words = telltaleWords(journey);
    for (const stop of journey.stops) {
      for (const lang of LOCALES) {
        const shown = stopLabelInPlay(stop, journey, lang);
        if (!shown) continue;
        checked++;
        const leaks = words.filter((word) => contains(shown, word));
        if (leaks.length) {
          problems.push({ where: `wayfarer ${journey.id} stop.${lang}`, text: shown, hits: leaks.map((term) => ({ term, kind: "answer" })) });
        }
      }
    }
  }

  // ── Interface texts ──
  const games = await readdir(path.join(ROOT, "games"), { withFileTypes: true });
  for (const entry of games) {
    if (!entry.isDirectory()) continue;
    let source;
    try {
      source = await readFile(path.join(ROOT, "games", entry.name, "messages.ts"), "utf8");
    } catch {
      continue;
    }
    for (const m of source.matchAll(/^\s*(\w+):\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/gm)) {
      check(`${entry.name} messages ${m[1]}`, m[2].slice(1, -1));
    }
  }

  // ── Report ──
  for (const { where, text, hits } of problems) {
    console.log(`✗ ${where}\n    ${text}\n    → ${hits.map((hit) => `${hit.term} (${hit.kind})`).join(", ")}`);
  }
  console.log(`\nChecked ${checked} texts: ${problems.length ? `${problems.length} give a place away.` : "none gives a place away."}`);
  process.exit(problems.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
