// Draws the site's own images: the app icons a phone shows when the site is
// installed, and the card shown when a link to it is shared.
//
//   npm run images
//
// Everything is drawn as SVG here and turned into PNG with sharp (which Next
// installs). The outputs are committed; run this again only to change them.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import sharp from "sharp";
import { feature } from "topojson-client";

const PAPER = "#f0e8d6";
const CARD = "#f8f2e4";
const INK = "#1d1915";
const INK_2 = "#5f5646";
const GUESS = "#c8412b";
const ANSWER = "#1b6b62";
const LAND = "#d9c9a2";
const LAND_EDGE = "#8f7e5b";

/** The globe with a pin, as in app/icon.svg, drawn `size` wide around the centre of a `box`-wide square. */
function globe(box, size) {
  const k = size / 32;
  const at = (box - size) / 2;
  return `<g transform="translate(${at} ${at}) scale(${k})">
    <circle cx="16" cy="16" r="10.5" fill="none" stroke="${INK}" stroke-width="1.6"/>
    <ellipse cx="16" cy="16" rx="4.6" ry="10.5" fill="none" stroke="${INK}" stroke-width="1.2"/>
    <path d="M5.5 16h21" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="20.5" cy="11.5" r="4" fill="${GUESS}" stroke="${PAPER}" stroke-width="1.6"/>
  </g>`;
}

/** A square icon. `inset` is how much of the square the globe fills (maskable icons keep clear of the edge). */
function icon(size, { radius = 0, fill = 1 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${PAPER}"/>
    ${globe(size, size * fill)}
  </svg>`;
}

/** The card for shared links: the title as on the hub, beside the world. */
function card() {
  const width = 1200;
  const height = 630;
  const world = feature(
    JSON.parse(readFileSync("public/geo/countries-50m.json", "utf8")),
    "land",
  );
  const projection = geoNaturalEarth1()
    .rotate([-11, 0])
    .fitExtent(
      [
        [560, 150],
        [1130, 480],
      ],
      { type: "Sphere" },
    );
  const path = geoPath(projection);
  const pin = projection([-43.2, -22.9]);
  const serif = "Georgia, 'Times New Roman', serif";
  const mono = "'Courier New', monospace";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${PAPER}"/>
    <rect x="28" y="28" width="${width - 56}" height="${height - 56}" fill="${CARD}" stroke="${INK}" stroke-width="3"/>
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="2"/>

    <path d="${path({ type: "Sphere" })}" fill="${PAPER}"/>
    <path d="${path(geoGraticule10())}" fill="none" stroke="${INK}" stroke-opacity="0.1" stroke-width="1"/>
    <path d="${path(world)}" fill="${LAND}" stroke="${LAND_EDGE}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="${path({ type: "Sphere" })}" fill="none" stroke="${INK}" stroke-width="2"/>
    <circle cx="${pin[0]}" cy="${pin[1]}" r="26" fill="none" stroke="${ANSWER}" stroke-width="2" stroke-opacity="0.5"/>
    <circle cx="${pin[0]}" cy="${pin[1]}" r="11" fill="${GUESS}" stroke="${CARD}" stroke-width="4"/>

    <g font-family="${serif}" font-size="132" fill="${INK}" letter-spacing="-6">
      <text x="84" y="204">Who</text>
      <text x="132" y="330" font-style="italic" fill="${GUESS}">When</text>
      <text x="84" y="456">Where</text>
    </g>
    <path d="M86 500h400" stroke="${INK}" stroke-width="2"/>
    <text x="86" y="540" font-family="${mono}" font-size="25" font-weight="bold" letter-spacing="2" fill="${INK_2}">DAILY GUESSING GAMES,</text>
    <text x="86" y="574" font-family="${mono}" font-size="25" font-weight="bold" letter-spacing="2" fill="${INK_2}">ALL PLAYED ON THE MAP</text>
  </svg>`;
}

async function write(file, svg) {
  writeFileSync(file, await sharp(Buffer.from(svg)).png().toBuffer());
  console.log(file);
}

mkdirSync("public/icons", { recursive: true });
await write("public/icons/icon-192.png", icon(192, { radius: 36 }));
await write("public/icons/icon-512.png", icon(512, { radius: 96 }));
// Maskable: the device cuts its own shape out of it, so the paper runs to the edge.
await write("public/icons/icon-maskable-512.png", icon(512, { fill: 0.72 }));
await write("app/apple-icon.png", icon(180, { fill: 0.9 }));
await write("app/opengraph-image.png", card());
writeFileSync("app/opengraph-image.alt.txt", "Who When Where — daily guessing games, all played on the map\n");
