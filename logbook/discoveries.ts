"use client";

import { SITES, siteById } from "@/games/dig-site/sites";
import { isOver as digSiteOver } from "@/games/dig-site/rules";
import { useSave as useDigSite } from "@/games/dig-site/store";
import { EVENTS } from "@/games/first-to-last/events";
import { isOver as firstToLastOver, truthOf } from "@/games/first-to-last/rules";
import { puzzleOf as lineUpOf, useSave as useFirstToLast } from "@/games/first-to-last/store";
import { TARGETS, isOver as outlineOver } from "@/games/outline/rules";
import { useSave as useOutline } from "@/games/outline/store";
import { isOver as overlandOver, isPlayable } from "@/games/overland/rules";
import { useSave as useOverland } from "@/games/overland/store";
import { JOURNEYS, journeyById } from "@/games/wayfarer/journeys";
import { isOver as wayfarerOver } from "@/games/wayfarer/rules";
import { useSave as useWayfarer } from "@/games/wayfarer/store";
import { PEOPLE, personById } from "@/games/who-when-where/people";
import { isComplete, useSave as useWhoWhenWhere } from "@/games/who-when-where/store";
import { countryById, shortestRoute, type Country } from "@/lib/countries";
import type { LatLon } from "@/lib/geo";
import type { Localized } from "@/lib/i18n";

// What the player has come across: every person, journey, site, moment and
// country a finished puzzle revealed, read from the games saved on the device.

export const KINDS = ["person", "journey", "site", "event", "country", "crossing"] as const;
export type Kind = (typeof KINDS)[number];

export type Discovery = {
  kind: Kind;
  /** Unique within its kind. */
  id: string;
  /** The puzzle number it came up on (the latest, when it came up twice). */
  day: number;
  name: Localized;
  /** Where its pin goes on the atlas. */
  place: LatLon;
  /** A line to draw: a journey's route, the countries of a crossing. */
  route?: LatLon[];
  /** The country to colour in. */
  country?: Country;
  wiki?: { en: string; pt: string | null };
};

/** How many there are to find of each kind; null where there is no end to them. */
export const TOTALS: Record<Kind, number | null> = {
  person: PEOPLE.length,
  journey: JOURNEYS.length,
  site: SITES.length,
  event: EVENTS.length,
  country: TARGETS.length,
  crossing: null,
};

const days = <T,>(save: { days: Record<string, T> }): [number, T][] =>
  Object.entries(save.days ?? {})
    .map(([day, record]): [number, T] => [Number(day), record])
    .filter(([day]) => Number.isInteger(day) && day >= 1);

/** Everything discovered so far, oldest first. */
export function useDiscoveries(): Discovery[] {
  const [lives] = useWhoWhenWhere();
  const [journeys] = useWayfarer();
  const [digs] = useDigSite();
  const [lineUps] = useFirstToLast();
  const [crossings] = useOverland();
  const [outlines] = useOutline();

  const found = new Map<string, Discovery>();
  const add = (discovery: Discovery) => found.set(`${discovery.kind}:${discovery.id}`, discovery);

  // A day saved by an older version, or a damaged one, discovers nothing.
  const each = <T,>(save: { days: Record<string, T> }, read: (day: number, record: T) => void) => {
    for (const [day, record] of days(save)) {
      try {
        read(day, record);
      } catch {
        // Skip it.
      }
    }
  };

  each(lives, (day, record) => {
    const person = personById(record.personId);
    if (!person || !isComplete(record)) return;
    add({ kind: "person", id: person.id, day, name: person.name, place: person.birth.place, wiki: person.wiki });
  });

  each(journeys, (day, record) => {
    const journey = journeyById(record.journeyId);
    if (!journey || !wayfarerOver(journey.id, record.guesses)) return;
    add({
      kind: "journey",
      id: journey.id,
      day,
      name: journey.name,
      place: journey.stops[0],
      route: journey.stops,
      wiki: journey.wiki,
    });
  });

  each(digs, (day, record) => {
    const site = siteById(record.siteId);
    if (!site || !digSiteOver(record.digs)) return;
    add({ kind: "site", id: site.id, day, name: site.name, place: site, wiki: site.wiki });
  });

  each(lineUps, (day) => {
    const { events, attempts } = lineUpOf(lineUps, day);
    if (!firstToLastOver(attempts, truthOf(events))) return;
    for (const event of events) add({ kind: "event", id: event.id, day, name: event.name, place: event });
  });

  each(crossings, (day, record) => {
    if (!isPlayable(record) || !overlandOver(record, record.guesses)) return;
    const way = shortestRoute(record.from, record.to, new Set(record.guesses))
      .map((id) => countryById(id))
      .filter((country): country is Country => country !== undefined);
    const [from, to] = [way[0], way[way.length - 1]];
    if (!from || !to) return;
    add({
      kind: "crossing",
      id: `${from.id}-${to.id}`,
      day,
      name: { en: `${from.name.en} → ${to.name.en}`, pt: `${from.name.pt} → ${to.name.pt}` },
      place: from,
      route: way,
    });
  });

  each(outlines, (day, record) => {
    const country = countryById(record.countryId);
    if (!country || !outlineOver(country.id, record.guesses)) return;
    add({ kind: "country", id: country.id, day, name: country.name, place: country, country });
  });

  return [...found.values()].sort((a, b) => a.day - b.day);
}
