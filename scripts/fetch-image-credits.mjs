// Adds a credit (file, author, licence, source) to every image in the
// Who When Where and Dig Site rosters, without touching anything else:
//
//   npm run data:credits
//
// The images were made from each article's Wikipedia summary thumbnail
// (scripts/fetch-people.mjs, scripts/fetch-sites.mjs). This reads the same
// summaries (from scripts/.cache when they are there), finds the file each
// thumbnail was cut from, and asks Wikimedia Commons who made it and under
// which licence. fetch-people and fetch-sites write credits too; this is for
// the data already built.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, cleanTitle, getImageCredits, getSummary, slugify } from "./lib/wiki.mjs";
import { ROSTER } from "./people-roster.mjs";
import { SITES } from "./sites-roster.mjs";

const PEOPLE_JSON = path.join(ROOT, "games/who-when-where/data/people.json");
const SITES_JSON = path.join(ROOT, "games/dig-site/data/sites.json");

/** Adds credits to the entries of `file`; `thumbs` maps an entry's id to its thumbnail URL. */
async function credit(file, thumbs) {
  const entries = JSON.parse(await readFile(file, "utf8"));
  const credits = await getImageCredits([...thumbs.values()]);
  const missing = [];
  const licences = {};
  for (const entry of entries) {
    if (!entry.image) continue;
    const found = credits.get(thumbs.get(entry.id));
    if (!found) {
      missing.push(entry.id);
      continue;
    }
    // `credit` goes last, so the diff only adds it.
    const image = { ...entry.image };
    delete image.credit;
    entry.image = { ...image, credit: found };
    licences[found.licence] = (licences[found.licence] ?? 0) + 1;
  }
  await writeFile(file, JSON.stringify(entries, null, 2) + "\n");
  const withImage = entries.filter((entry) => entry.image).length;
  console.log(`${path.relative(ROOT, file)}: ${withImage - missing.length}/${withImage} credited`);
  for (const [licence, count] of Object.entries(licences).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)}  ${licence}`);
  }
  if (missing.length) console.log(`  ⚠ no credit for: ${missing.join(", ")}`);
  return missing.length;
}

async function main() {
  const people = new Map();
  for (const title of ROSTER) {
    const summary = await getSummary("en", title);
    if (summary.thumbnail) people.set(slugify(title), summary.thumbnail.source);
  }

  const sites = new Map();
  for (const site of SITES) {
    const summary = await getSummary("en", site.title);
    const id = slugify(site.name?.en ?? cleanTitle(summary.title));
    if (summary.thumbnail) sites.set(id, summary.thumbnail.source);
  }

  const missing = (await credit(PEOPLE_JSON, people)) + (await credit(SITES_JSON, sites));
  if (missing) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
