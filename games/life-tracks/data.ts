import { dailyIndex, seededRandom } from "@/lib/daily";
import type { Localized } from "@/lib/i18n";
import { NOTABLES, notableById, type Notable } from "@/lib/notables";
import { defineSetData, pickOne } from "../engines/kit";
import { ladderScore } from "../engines/rules";
import { definition } from "./definition";
import tracks from "./data/tracks.json";

// Life Tracks without its interface: a famous life as a route on the map —
// where they were born, the places they lived, studied and worked in, where
// they died — revealed stop by stop. One person, a few guesses: every miss
// shows the next stop, the last guess the whole route and their field.
// data/tracks.json is built by scripts/fetch-life-tracks.mjs from Wikidata.

export const MAX_GUESSES = 5;

export type StopKind = "born" | "lived" | "studied" | "worked" | "died";

export type Stop = {
  /** The town: never the person's own name. */
  name: Localized;
  lat: number;
  lon: number;
  year: number | null;
  kind: StopKind;
  /** The school or employer there, shown once the puzzle is over. */
  at?: Localized;
};

/** A puzzle: the person and the route of their life. */
export type Track = { person: Notable; stops: Stop[] };

type Raw = { id: string; stops: Stop[] };

/** Every life with a route, whose person is still in the roster. */
export const TRACKS: Track[] = (tracks as Raw[]).flatMap((raw) => {
  const person = notableById(raw.id);
  return person && raw.stops.length >= 4 ? [{ person, stops: raw.stops }] : [];
});

const byId = new Map(TRACKS.map((track) => [track.person.id, track]));

/** The daily answers: the better known lives. Practice deals from all of them. */
const DAILY = TRACKS.filter((track) => track.person.fame >= 80);

/** Everyone a player can name: the whole roster, so the answer isn't obvious from a short list. */
export const NAMEABLE = NOTABLES.map((person) => ({ id: person.id, name: person.name }));

/** Stops on show before the first guess: three when the route is long. */
export const firstShown = (track: Track) => (track.stops.length >= 8 ? 3 : 2);

/**
 * How many stops are on the map after `used` guesses out of `max`: one more
 * per miss, and the whole route on the last guess and once it is over.
 */
export function stopsShown(track: Track, used: number, max: number, over: boolean): number {
  const total = track.stops.length;
  if (over || used >= max - 1) return total;
  return Math.min(total, firstShown(track) + used);
}

/** The field (their occupation) is the last guess's extra clue. */
export const fieldShown = (used: number, max: number, over: boolean) => over || used >= max - 1;

/** The birth century, in the way people count them: 1801–1900 is one. */
export const centuryOf = (year: number) => (year > 0 ? Math.ceil(year / 100) : -Math.ceil(-year / 100));

export default defineSetData<Track, string>(definition.slug, {
  forDay: (day) => DAILY[dailyIndex(DAILY.length, day, `${definition.slug}:day`)],
  deal: (seed) => pickOne(TRACKS, seededRandom(`${definition.slug}:${seed}`)),
  fromIds: ([id]) => (id === undefined ? undefined : byId.get(id)),
  idsOf: (track) => [track.person.id],
  score: (track, guesses, tries = MAX_GUESSES) => ladderScore(track.person.id, guesses, tries),
  answer: (track, locale) => track.person.name[locale],
});
