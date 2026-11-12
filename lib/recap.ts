// A day of the dailies, written into a link: the recap page (/daily/recap)
// and its share card image (/daily/card) are drawn from it, so a pasted link
// unfurls into the card. Plain data: used in the browser and on the server.
//
//   /daily/recap?d=3&r=who-when-where:812,wayfarer:640,dig-site:-&s=4&l=en
//
// d: the puzzle number · r: each daily as slug:points ("-" = not played)
// s: the streak · l: the language of the card. Slugs, not positions, so a
// link stays right after the daily set changes.

import { MAX_POINTS } from "./points";

export type Recap = {
  day: number;
  scores: { game: string; points: number | null }[];
  streak: number;
  locale: "en" | "pt";
};

const MAX_GAMES = 10;
const SLUG = /^[a-z0-9-]{1,40}$/;

/** The query string of a recap link (without "?"). */
export function recapQuery(recap: Recap): string {
  const params = new URLSearchParams({
    d: String(recap.day),
    r: recap.scores.map(({ game, points }) => `${game}:${points === null ? "-" : points}`).join(","),
    s: String(recap.streak),
    l: recap.locale,
  });
  // Commas and colons read fine in a link; keep them as they are.
  return params.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
}

const whole = (value: string | null | undefined, max: number): number | null => {
  if (!value || !/^\d{1,7}$/.test(value)) return null;
  const n = Number(value);
  return n <= max ? n : null;
};

/** Reads a recap link's parameters; null when they don't make one. `known` says which slugs are games. */
export function readRecap(get: (name: string) => string | null | undefined, known: (slug: string) => boolean): Recap | null {
  const day = whole(get("d"), 1_000_000);
  if (!day) return null;
  const scores: Recap["scores"] = [];
  for (const part of (get("r") ?? "").split(",").slice(0, MAX_GAMES)) {
    const [game, value] = part.split(":");
    if (!game || !SLUG.test(game) || !known(game) || scores.some((score) => score.game === game)) continue;
    scores.push({ game, points: value === "-" ? null : whole(value, MAX_POINTS) });
  }
  if (!scores.length) return null;
  return { day, scores, streak: whole(get("s"), 1_000_000) ?? 0, locale: get("l") === "pt" ? "pt" : "en" };
}

/** The total of a recap, and the most it could have been. */
export function recapTotal(recap: Recap): { points: number; max: number; done: number } {
  const played = recap.scores.filter((score) => score.points !== null);
  return {
    points: played.reduce((sum, score) => sum + (score.points ?? 0), 0),
    max: recap.scores.length * MAX_POINTS,
    done: played.length,
  };
}
