"use client";

import Image from "next/image";
import { useState } from "react";
import { Daily } from "@/components/daily";
import { GamePanels } from "@/components/game-panels";
import { Question } from "@/components/question";
import { ReadMore, ResultActions } from "@/components/result-footer";
import { WorldMap, useMapLabels, type MapMarker, type MapRing } from "@/components/world-map";
import { formatCoordinates, type LatLon } from "@/lib/geo";
import { formatNumber, useSiteT } from "@/lib/i18n";
import { useGameT, type MessageKey } from "./messages";
import { FOUND_KM, MAX_DIGS, closestKm, gradeDig, heatOf, isFound, isOver } from "./rules";
import { shareText } from "./share";
import { siteById, siteForDay, siteLabel } from "./sites";
import { computeStats, useSave } from "./store";

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

export function DigSite() {
  // Keyed by day: at midnight the next puzzle starts from a clean slate.
  return <Daily>{(day) => <Play key={day} day={day} />}</Daily>;
}

function Play({ day }: { day: number }) {
  const [save, setSave] = useSave();
  const { locale, t } = useGameT();
  const siteT = useSiteT();
  const mapLabels = useMapLabels();
  const [pin, setPin] = useState<LatLon | null>(null);

  // A saved record names its site, so a roster change can't reassign it.
  const stored = save.days[day];
  const record = stored && siteById(stored.siteId) ? stored : undefined;
  const site = (record && siteById(record.siteId)) ?? siteForDay(day);
  const digs = record?.digs ?? [];
  const found = isFound(digs);
  const over = isOver(digs);
  const last = digs.at(-1);

  function dig() {
    if (!pin || over) return;
    const graded = gradeDig(site, pin);
    setSave((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [day]: { siteId: site.id, digs: [...(previous.days[day]?.digs ?? []), graded] },
      },
    }));
    setPin(null);
  }

  const heatName = (km: number) => t(`heat${heatOf(km)}` as MessageKey);
  const tone = (km: number) => `heat-${heatOf(km)}`;

  const markers: MapMarker[] = digs.map((entry, i) => ({
    lat: entry.lat,
    lon: entry.lon,
    kind: "guess",
    badge: String(i + 1),
    tone: tone(entry.km),
  }));
  if (over) markers.push({ ...site, kind: "answer", label: site.name[locale] });
  else if (pin) markers.push({ ...pin, kind: "guess" });

  // The site lies somewhere on each ring.
  const rings: MapRing[] = digs
    .filter((entry) => entry.km > FOUND_KM)
    .map((entry) => ({ ...entry, tone: tone(entry.km) }));

  const nearest = digs.find((entry) => entry.km === closestKm(digs));
  const stats = computeStats(save, day);

  return (
    <main className="game" data-summary={over ? "" : undefined}>
      <aside className="dossier">
        <div className="plate" data-revealed={over ? "" : undefined}>
          <Image
            src={site.image.src}
            alt={over ? site.name[locale] : t("mystery")}
            width={site.image.width}
            height={site.image.height}
            sizes="(min-width: 1024px) 280px, 112px"
            priority
          />
        </div>

        <div className="dossier-text">
          <p className="eyebrow">
            {siteT("puzzleNo", { n: day })} <span aria-hidden="true">—</span> {t("kicker")}
          </p>
          <h1 className="dossier-name">{over ? site.name[locale] : t("mystery")}</h1>
          <p className="dossier-description">
            {site.clue[locale]}
            <span className="dossier-dates">{site.era[locale]}</span>
          </p>
        </div>

        <ol className="progress" style={{ "--steps": MAX_DIGS } as React.CSSProperties}>
          {Array.from({ length: MAX_DIGS }, (_, i) => {
            const entry = digs[i];
            const state = entry ? "done" : i === digs.length && !over ? "current" : "todo";
            return (
              <li key={i} data-state={state} data-tone={entry && tone(entry.km)}>
                <span className="progress-numeral">{NUMERALS[i]}</span>
                <span className="progress-label">{entry ? heatName(entry.km) : " "}</span>
                <span className="progress-score">
                  {entry ? (
                    <>
                      {formatNumber(entry.km, locale)}
                      <small> km</small>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="stage">
        {over ? (
          <div className="result-head" role="status">
            <div className="stamp" data-lost={found ? undefined : ""}>
              <strong>
                {found ? digs.length : "×"}/{MAX_DIGS}
              </strong>
              <span>{t("digs")}</span>
            </div>
            <div className="verdict-text">
              <p className="verdict-headline">
                {!found
                  ? t("lost")
                  : digs.length === 1
                    ? t("foundFirst")
                    : t("foundIn", { n: digs.length })}
              </p>
              <p className="verdict-answer">
                {siteLabel(site, locale)}
                {!found && ` · ${t("lostDetail", { km: formatNumber(closestKm(digs), locale) })}`}
              </p>
            </div>
          </div>
        ) : (
          <Question text={t("question")} />
        )}

        <WorldMap
          markers={markers}
          rings={rings}
          onPick={over ? undefined : setPin}
          focus={over && nearest ? [site, nearest] : undefined}
          labels={mapLabels}
          ariaLabel={t("mapAria")}
        >
          {over ? null : pin ? (
            <>
              <b>{t("nextDig", { n: digs.length + 1 })}</b> {formatCoordinates(pin)}
            </>
          ) : (
            t("mapHint")
          )}
        </WorldMap>

        {over ? (
          <div className="summary">
            <ResultActions path="/dig-site" shareText={(url) => shareText(day, digs, url)} />
            <ReadMore
              text={site.extract[locale] ?? site.extract.en}
              href={site.wiki[locale] ?? site.wiki.en}
              credit={siteT("photoCredit")}
            />
          </div>
        ) : (
          <div className="controls">
            <div>
              {last && (
                <p className="feedback" data-tone={tone(last.km)} role="status">
                  <b>{heatName(last.km)}</b>{" "}
                  {t("kmAway", { km: formatNumber(last.km, locale) })}
                </p>
              )}
              <p className="hint">{last ? t("ringHint") : t("firstHint", { n: MAX_DIGS })}</p>
            </div>
            <button type="button" className="button" disabled={!pin} onClick={dig}>
              {t("digHere")}
            </button>
          </div>
        )}
      </section>

      <GamePanels
        help={[t("help1"), t("help2"), t("help3"), t("help4"), t("help5")]}
        seenHelp={save.seenHelp}
        onSeenHelp={() => setSave((previous) => ({ ...previous, seenHelp: true }))}
        played={stats.played}
        tiles={[
          { label: siteT("statPlayed"), value: stats.played },
          { label: t("statFound"), value: `${stats.foundRate}%` },
          { label: t("statAverage"), value: stats.averageDigs },
          { label: siteT("statStreak"), value: stats.streak },
          { label: siteT("statLongest"), value: stats.longestStreak },
        ]}
      />
    </main>
  );
}
