// Daily puzzle clock, shared by every game on the site.
// A "day" is the player's local calendar day; day 1 is the launch date.

const DAY_MS = 86_400_000;
const LAUNCH_UTC = Date.UTC(2026, 10, 10); // 10 Nov 2026

export function dayNumberFor(date: Date): number {
  const localMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((localMidnight - LAUNCH_UTC) / DAY_MS) + 1;
}

export function yearOfDay(day: number): number {
  return new Date(LAUNCH_UTC + (day - 1) * DAY_MS).getUTCFullYear();
}

/** The calendar date of a puzzle number, at midnight UTC: read it with the getUTC… methods. */
export function dateOfDay(day: number): Date {
  return new Date(LAUNCH_UTC + (day - 1) * DAY_MS);
}

export function msUntilTomorrow(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A repeatable random number generator (0 ≤ n < 1) for a text seed. */
export function seededRandom(seed: string): () => number {
  return mulberry32(hashString(seed));
}

/** A shuffled copy of `items`, always the same for the same seed. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const random = seededRandom(seed);
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Index of the item to play on `day`, out of `count` items.
 *
 * Every item is played once per cycle of `count` days, in an order shuffled
 * per game (`salt`) and reshuffled each cycle. Changing `count` reshuffles the
 * schedule, so grow a roster between cycles if the order matters.
 */
export function dailyIndex(count: number, day: number, salt: string): number {
  const n = day - 1;
  const cycle = Math.floor(n / count);
  const position = ((n % count) + count) % count;
  const random = mulberry32(hashString(`${salt}:${cycle}`));
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[position];
}
