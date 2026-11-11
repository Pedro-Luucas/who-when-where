import { dealFrom } from "../platform/deal";
import { defineData } from "../platform/types";
import { definition } from "./definition";
import { isOver, scoreOf, type Dig } from "./rules";
import { SITES, siteById, siteForDay, siteLabel, type Site } from "./sites";
import { resultOf, type DayRecord } from "./store";

/** Dig Site without its interface: the roster, the scoring, what a finished dig reveals. */
export default defineData<Site, Dig, DayRecord>(definition.slug, {
  puzzleForDay: siteForDay,
  deal: dealFrom(SITES.map((site) => site.id)),
  puzzleOf: ([id]) => siteById(id),
  puzzleOfRecord: (record) => siteById(record.siteId),
  idsOf: (site) => [site.id],
  recordOf: (site, digs) => ({ siteId: site.id, digs }),
  score: (_site, digs, max) => scoreOf(digs, max),
  resultOf,
  answer: siteLabel,
  discover(record, day) {
    const site = siteById(record.siteId);
    if (!site || !isOver(record.digs)) return [];
    return [{ kind: "site", id: site.id, day, name: site.name, place: site, wiki: site.wiki }];
  },
  totals: { site: SITES.length },
});
