// Builds games/wayfarer/data/journeys.json.
//
//   node scripts/fetch-journeys.mjs
//
// The routes themselves are hand-drawn in scripts/journeys-roster.mjs; this
// adds the closing text and the "read more" links from Wikipedia (English
// and Portuguese).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, getEntities, getPtSummary, getSummary } from "./lib/wiki.mjs";
import { JOURNEYS } from "./journeys-roster.mjs";

const OUT_JSON = path.join(ROOT, "games/wayfarer/data/journeys.json");

async function main() {
  await mkdir(path.dirname(OUT_JSON), { recursive: true });

  console.log(`Fetching ${JOURNEYS.length} Wikipedia summaries…`);
  const summaries = [];
  for (const { title } of JOURNEYS) summaries.push(await getSummary("en", title));
  const entities = await getEntities(
    summaries.map((s) => s.wikibase_item),
    "sitelinks",
  );

  const result = [];
  for (const [i, { title, stops, ...journey }] of JOURNEYS.entries()) {
    const summary = summaries[i];
    const ptSummary = await getPtSummary(entities[summary.wikibase_item]);
    result.push({
      ...journey,
      stops: stops.map(([lat, lon, en, pt]) => ({
        lat,
        lon,
        ...(en && { name: { en, pt: pt ?? en } }),
      })),
      extract: { en: summary.extract, pt: ptSummary?.extract ?? null },
      wiki: {
        en: summary.content_urls.desktop.page,
        pt: ptSummary?.content_urls.desktop.page ?? null,
      },
    });
    console.log(
      `${String(i + 1).padStart(2)}. ${journey.name.en} — "${summary.title}"` +
        (ptSummary ? ` / "${ptSummary.title}"` : "   ⚠ no pt.wikipedia article") +
        (title !== summary.title ? `   (asked for "${title}")` : ""),
    );
  }

  await writeFile(OUT_JSON, JSON.stringify(result, null, 1) + "\n");
  console.log(`\nWrote ${result.length} journeys to ${path.relative(ROOT, OUT_JSON)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
