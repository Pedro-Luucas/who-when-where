// Copies the flag of every country the site plays with (lib/data/countries.json)
// into public/flags/<id>.svg, for Flag Peek and anywhere else a flag is shown.
//
// Source: the `flag-icons` npm package by Panayiotis Lipiridis (MIT licence),
// https://github.com/lipis/flag-icons. It is not a dependency of the site:
// download its tarball from the npm registry, extract it somewhere outside the
// repository's source, and point the script at the extracted `package` folder.
//
//   npm run data:flags -- <path-to-extracted-flag-icons-package>
//
// The 4×3 flags are used, lightly minified. Their licence is copied next to
// them (public/flags/LICENSE.txt).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const COUNTRIES = "lib/data/countries.json";
const TARGET = "public/flags";

const source = process.argv[2];
if (!source || !existsSync(join(source, "flags", "4x3"))) {
  console.error("Usage: node scripts/build-flags.mjs <path-to-extracted-flag-icons-package>");
  process.exit(1);
}

/** Drops comments, metadata and the whitespace between tags; keeps the drawing as it is. */
function minify(svg) {
  return svg
    .replace(/<\?xml[^>]*>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const countries = JSON.parse(readFileSync(COUNTRIES, "utf8"));
mkdirSync(TARGET, { recursive: true });

let copied = 0;
let bytes = 0;
const missing = [];
for (const { id } of countries) {
  const file = join(source, "flags", "4x3", `${id}.svg`);
  if (!existsSync(file)) {
    missing.push(id);
    continue;
  }
  const svg = minify(readFileSync(file, "utf8"));
  writeFileSync(join(TARGET, `${id}.svg`), svg);
  copied++;
  bytes += Buffer.byteLength(svg);
}

const licence = readFileSync(join(source, "LICENSE"), "utf8");
writeFileSync(
  join(TARGET, "LICENSE.txt"),
  `The flags in this folder come from flag-icons (https://github.com/lipis/flag-icons),\n` +
    `copied unchanged apart from whitespace by scripts/build-flags.mjs.\n\n${licence}`,
);

console.log(`${copied} of ${countries.length} flags written to ${TARGET} (${Math.round(bytes / 1024)} KB)`);
if (missing.length) console.warn(`No flag for: ${missing.join(", ")}`);
