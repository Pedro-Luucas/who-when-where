"use client";

import { Suspense } from "react";
import { BrowserOnly } from "@/components/controls";
import { WorldMap, useMapLabels, type MapMarker, type MapRegion, type MapRoute } from "@/components/world-map";
import { activityOf, streakDays, useDailyResults } from "@/games/results";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { streaks } from "@/lib/stats";
import { ActivityGraph } from "@/social/activity-graph";
import { standingsOf, type Standing } from "./achievements";
import { KINDS, useDiscoveries, type Kind } from "./discoveries";
import { levelOf } from "./level";
import { useLogbookT, type LogbookKey } from "./messages";

/** The logbook page: the player's level, their achievements and their atlas. */
export function Logbook() {
  return (
    <BrowserOnly>
      <Book />
    </BrowserOnly>
  );
}

function Book() {
  const { locale, t } = useLogbookT();
  const today = useDayNumber();
  const results = useDailyResults();

  const activity = activityOf(results);
  const points = results.reduce((sum, result) => sum + result.points, 0);
  const { streak, longest } = streaks(streakDays(results), today);
  const { level, into, step, rank } = levelOf(points);
  const standings = standingsOf(results, today);
  const earned = standings.filter((standing) => standing.unlocked).length;

  const tiles = [
    { label: t("statPuzzles"), value: results.length },
    { label: t("statPoints"), value: points },
    { label: t("statDays"), value: activity.length },
    { label: t("statStreak"), value: streak },
    { label: t("statLongest"), value: longest },
    { label: t("achievements"), value: earned },
  ];

  return (
    <main className="page logbook">
      <header className="page-head">
        <h1>{t("logbook")}</h1>
        <p>{t("lead")}</p>
      </header>

      <section className="panel level" aria-label={t("level", { n: level })}>
        <i className="seal seal-large" aria-hidden="true">
          {level}
        </i>
        <div className="level-text">
          <p className="eyebrow">{t("level", { n: level })}</p>
          <h2>{t(`rank${rank}` as LogbookKey)}</h2>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={step} aria-valuenow={into}>
            <i style={{ width: `${(into / step) * 100}%` }} />
          </div>
          <p className="hint">{t("toNext", { n: formatNumber(step - into, locale), next: level + 1 })}</p>
        </div>
        <dl className="level-stats">
          {tiles.map((tile) => (
            <div key={tile.label}>
              <dd>{formatNumber(tile.value, locale)}</dd>
              <dt>{tile.label}</dt>
            </div>
          ))}
        </dl>
        <ActivityGraph activity={activity} today={today} />
      </section>

      <section className="panel" aria-labelledby="achievements-heading">
        <div className="panel-head">
          <h2 id="achievements-heading">{t("achievements")}</h2>
          <span className="eyebrow">{t("achievementsCount", { n: earned, total: standings.length })}</span>
        </div>
        <ul className="badges">
          {/* Earned ones first; each group keeps the order they are listed in. */}
          {[...standings]
            .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
            .map((standing) => (
              <Badge key={standing.achievement.id} standing={standing} />
            ))}
        </ul>
      </section>

      {/* The atlas asks every game what was found: it arrives once they are fetched. */}
      <Suspense
        fallback={
          <section className="panel atlas" aria-busy="true">
            <div className="page-skeleton skeleton-block" />
          </section>
        }
      >
        <Atlas />
      </Suspense>
    </main>
  );
}

function Badge({ standing }: { standing: Standing }) {
  const { locale, t } = useLogbookT();
  const { achievement, count, unlocked } = standing;
  return (
    <li className="badge-card" data-earned={unlocked ? "" : undefined}>
      <i className="seal" aria-hidden="true">
        {achievement.mark}
      </i>
      <span>
        <b>{t(`ach_${achievement.id}` as LogbookKey)}</b>
        <small>{t(`ach_${achievement.id}_how` as LogbookKey)}</small>
        {unlocked ? (
          <em>{t("earned")}</em>
        ) : (
          achievement.goal > 1 && (
            <span className="badge-progress">
              <span className="bar" aria-hidden="true">
                <i style={{ width: `${(count / achievement.goal) * 100}%` }} />
              </span>
              <small>
                {formatNumber(count, locale)}/{formatNumber(achievement.goal, locale)}
              </small>
            </span>
          )
        )}
      </span>
    </li>
  );
}

function Atlas() {
  const { locale, t } = useLogbookT();
  const { discoveries, totals } = useDiscoveries();
  const mapLabels = useMapLabels();

  const markers: MapMarker[] = [];
  const routes: MapRoute[] = [];
  const regions: MapRegion[] = [];
  for (const found of discoveries) {
    const label = found.name[locale];
    switch (found.kind) {
      case "person":
        markers.push({ ...found.place, kind: "guess", label });
        break;
      case "site":
        markers.push({ ...found.place, kind: "guess", tone: "on", label });
        break;
      case "event":
        markers.push({ ...found.place, kind: "stop" });
        break;
      case "journey":
        routes.push({ points: found.route ?? [], kind: "route" });
        markers.push({ ...found.place, kind: "ghost", label });
        break;
      case "crossing":
        routes.push({ points: found.route ?? [], kind: "thread" });
        break;
      case "country":
        regions.push(...(found.country?.shapes ?? []).map((shape) => ({ shape, tone: "answer" })));
        break;
    }
  }

  const byKind = (kind: Kind) => discoveries.filter((found) => found.kind === kind);

  return (
    <section className="panel atlas" aria-labelledby="atlas-heading">
      <div className="panel-head">
        <h2 id="atlas-heading">{t("atlas")}</h2>
        <span className="eyebrow">{formatNumber(discoveries.length, locale)}</span>
      </div>
      <p className="hint">{discoveries.length ? t("atlasLead") : t("atlasEmpty")}</p>

      <WorldMap markers={markers} routes={routes} regions={regions} labels={mapLabels} ariaLabel={t("atlasAria")} />

      <ul className="collection">
        {KINDS.map((kind) => {
          const found = byKind(kind);
          const total = totals[kind];
          return (
            <li key={kind} data-kind={kind}>
              <details>
                <summary>
                  <i aria-hidden="true" />
                  <b>{t(`kind_${kind}`)}</b>
                  <span>
                    {total === null
                      ? formatNumber(found.length, locale)
                      : t("countOf", { n: formatNumber(found.length, locale), total: formatNumber(total, locale) })}
                  </span>
                  {total !== null && (
                    <span className="bar" aria-hidden="true">
                      <i style={{ width: `${(found.length / total) * 100}%` }} />
                    </span>
                  )}
                </summary>
                {found.length > 0 && (
                  <ol>
                    {[...found].reverse().map((entry) => {
                      const article = entry.wiki?.[locale] ?? entry.wiki?.en;
                      return (
                        <li key={entry.id}>
                          <small>{t("dayNo", { n: entry.day })}</small>
                          {article ? (
                            <a href={article} target="_blank" rel="noreferrer">
                              {entry.name[locale]}
                            </a>
                          ) : (
                            <span>{entry.name[locale]}</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
