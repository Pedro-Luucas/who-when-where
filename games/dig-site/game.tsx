"use client";

import Image from "next/image";
import { useState } from "react";
import { Question } from "@/components/question";
import { ReadMore } from "@/components/result-footer";
import { ResultHead } from "@/components/result-head";
import { WorldMap, useMapLabels, type MapMarker, type MapRing } from "@/components/world-map";
import { formatCoordinates, type LatLon } from "@/lib/geo";
import { formatNumber, useSiteT } from "@/lib/i18n";
import { useFinePointer } from "@/lib/pointer";
import { useGameT, type MessageKey } from "./messages";
import { FOUND_KM, MAX_DIGS, closestKm, gradeDig, heatOf, isFound, isOver, type Dig } from "./rules";
import { siteLabel, type Site } from "./sites";

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

type BoardProps = {
  site: Site;
  digs: Dig[];
  onDig: (dig: Dig) => void;
  maxDigs?: number;
  /** The line above the title: "No. 12 — Today's dig", "Stage 3 of 8 — Dig Site". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

/** One Dig Site puzzle. The digs live with whoever renders it. */
export function DigSiteBoard({ site, digs, onDig, maxDigs = MAX_DIGS, label, children }: BoardProps) {
  const { locale, t } = useGameT();
  const mouse = useFinePointer();
  const siteT = useSiteT();
  const mapLabels = useMapLabels();
  const [pin, setPin] = useState<LatLon | null>(null);

  const found = isFound(digs);
  const over = isOver(digs, maxDigs);
  const last = digs.at(-1);

  function dig() {
    if (!pin || over) return;
    onDig(gradeDig(site, pin));
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
            preload
          />
        </div>

        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <h1 className="dossier-name">{over ? site.name[locale] : t("mystery")}</h1>
          <p className="dossier-description">
            {site.clue[locale]}
            <span className="dossier-dates">{site.era[locale]}</span>
          </p>
        </div>

        <ol className="progress" style={{ "--steps": maxDigs } as React.CSSProperties}>
          {Array.from({ length: maxDigs }, (_, i) => {
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
          <ResultHead
            solved={found}
            used={digs.length}
            max={maxDigs}
            unit={t("digs")}
            headline={
              !found
                ? t("lost")
                : digs.length === 1
                  ? t("foundFirst")
                  : t("foundIn", { n: digs.length })
            }
          >
            {siteLabel(site, locale)}
            {!found && ` · ${t("lostDetail", { km: formatNumber(closestKm(digs), locale) })}`}
          </ResultHead>
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
            t(mouse ? "mapHintMouse" : "mapHint")
          )}
        </WorldMap>

        {over ? (
          <div className="summary">
            {children}
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
              <p className="hint">{last ? t("ringHint") : t("firstHint", { n: maxDigs })}</p>
            </div>
            <button type="button" className="button" disabled={!pin} onClick={dig}>
              {t("digHere")}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
