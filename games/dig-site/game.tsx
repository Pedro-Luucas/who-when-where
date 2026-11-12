"use client";

import Image from "next/image";
import { useState } from "react";
import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ReviewRow } from "@/components/play/result-card";
import { ImageCredit } from "@/components/image-credit";
import { Lightbox } from "@/components/ui/lightbox";
import { ReadMore } from "@/components/result-footer";
import { WorldMap, useMapLabels, type MapMarker, type MapRing } from "@/components/world-map";
import { formatCoordinates, type LatLon } from "@/lib/geo";
import { formatNumber, useSiteT } from "@/lib/i18n";
import { useFinePointer } from "@/lib/pointer";
import { useShellT } from "@/lib/shell-messages";
import { useGameT, type MessageKey } from "./messages";
import { lightboxImages, useGallery } from "./gallery";
import { FOUND_KM, MAX_DIGS, PASS, closestKm, gradeDig, heatOf, isFound, isOver, isPass, scoreOf, type Dig } from "./rules";
import { siteLabel, type Site } from "./sites";

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

type BoardProps = {
  site: Site;
  digs: Dig[];
  onDig: (dig: Dig) => void;
  /** Adds several digs at once (giving up passes every dig that is left). */
  onDigs: (digs: Dig[]) => void;
  maxDigs?: number;
  /** The line above the title: "No. 12 — Today's dig", "Stage 3 of 8 — Dig Site". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

/** One Dig Site puzzle. The digs live with whoever renders it. */
export function DigSiteBoard({ site, digs, onDig, onDigs, maxDigs = MAX_DIGS, label, children }: BoardProps) {
  const { locale, t } = useGameT();
  const shell = useShellT();
  const mouse = useFinePointer();
  const siteT = useSiteT();
  const mapLabels = useMapLabels();
  const [pin, setPin] = useState<LatLon | null>(null);
  /** The photo open in the lightbox, if any. */
  const [viewing, setViewing] = useState<number | null>(null);

  const found = isFound(digs);
  const over = isOver(digs, maxDigs);
  // The digs actually made: a given-up one has no place on the map.
  const made = digs.filter((entry) => !isPass(entry));
  const last = made.at(-1);
  // More photos of the site, fetched only once it is over: they would give it away.
  const photos = useGallery(site.id, over);
  const slides = over
    ? lightboxImages(site, photos, locale, (n) => t("galleryPhotoN", { name: site.name[locale], n }))
    : [];

  function dig() {
    if (!pin || over) return;
    onDig(gradeDig(site, pin));
    setPin(null);
  }

  const heatName = (km: number) => t(`heat${heatOf(km)}` as MessageKey);
  const tone = (km: number) => `heat-${heatOf(km)}`;

  const markers: MapMarker[] = made.map((entry, i) => ({
    lat: entry.lat,
    lon: entry.lon,
    kind: "guess",
    badge: String(i + 1),
    tone: tone(entry.km),
  }));
  if (over) markers.push({ ...site, kind: "answer", label: site.name[locale] });
  else if (pin) markers.push({ ...pin, kind: "guess" });

  // The site lies somewhere on each ring.
  const rings: MapRing[] = made
    .filter((entry) => entry.km > FOUND_KM)
    .map((entry) => ({ ...entry, tone: tone(entry.km) }));

  const closest = made.length ? closestKm(made) : null;
  const pips: Pip[] = Array.from({ length: maxDigs }, (_, i) => {
    const entry = digs[i];
    if (!entry) return i === digs.length && !over ? "current" : "todo";
    if (isPass(entry)) return "skip";
    return entry.km <= FOUND_KM ? "hit" : heatOf(entry.km) <= 2 ? "near" : "miss";
  });
  const review: ReviewRow[] = digs.map((entry, i) => ({
    id: String(i),
    label: shell("tryN", { n: i + 1 }),
    verdict: isPass(entry) ? "skip" : entry.km <= FOUND_KM ? "hit" : heatOf(entry.km) <= 2 ? "near" : "miss",
    yours: isPass(entry) ? shell("gaveUp") : heatName(entry.km),
    value: isPass(entry) ? undefined : `${formatNumber(entry.km, locale)} km`,
  }));
  const map = (
    <WorldMap
      markers={markers}
      rings={rings}
      onPick={over ? undefined : setPin}
      // Once it is over, every dig stays in the frame with the site.
      focus={over ? [site, ...made] : undefined}
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
  );

  return (
    <main className="game" data-game="dig-site" data-summary={over ? "" : undefined}>
      <Hud
        step={{ n: Math.min(digs.length + 1, maxDigs), total: maxDigs, kind: "try" }}
        pips={pips}
        stats={[
          {
            icon: "flag",
            label: shell("statClosest"),
            value: closest === null ? "—" : `${formatNumber(closest, locale)} km`,
          },
        ]}
        onGiveUp={() => onDigs(Array.from({ length: maxDigs - digs.length }, () => PASS))}
        over={over}
      />

      <aside className="dossier">
        <div className="plate" data-revealed={over ? "" : undefined}>
          {over ? (
            <button
              type="button"
              className="plate-button"
              onClick={() => setViewing(0)}
              aria-label={t("galleryEnlarge")}
              aria-haspopup="dialog"
            >
              <Image
                src={site.image.src}
                alt={site.name[locale]}
                width={site.image.width}
                height={site.image.height}
                sizes="(min-width: 1024px) 280px, 112px"
                preload
              />
              <span className="plate-zoom" aria-hidden="true">
                <ZoomIcon />
              </span>
            </button>
          ) : (
            <Image
              src={site.image.src}
              alt={t("mystery")}
              width={site.image.width}
              height={site.image.height}
              sizes="(min-width: 1024px) 280px, 112px"
              preload
            />
          )}
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
            const passed = entry && isPass(entry);
            const state = entry ? "done" : i === digs.length && !over ? "current" : "todo";
            return (
              <li key={i} data-state={state} data-tone={entry && !passed ? tone(entry.km) : undefined}>
                <span className="progress-numeral">{NUMERALS[i]}</span>
                <span className="progress-label">{passed ? shell("gaveUp") : entry ? heatName(entry.km) : " "}</span>
                <span className="progress-score">
                  {entry && !passed ? (
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
          <div className="summary">
            <ResultCard
              label={label}
              headline={!found ? t("lost") : digs.length === 1 ? t("foundFirst") : t("foundIn", { n: digs.length })}
              answer={
                <>
                  {siteLabel(site, locale)}
                  {!found && closest !== null && ` · ${t("lostDetail", { km: formatNumber(closest, locale) })}`}
                </>
              }
              points={scoreOf(digs, maxDigs).points}
              stats={[
                { label: shell("statTries"), value: `${found ? digs.length : "X"}/${maxDigs}`, tone: found ? "hit" : "miss" },
                { label: shell("statClosest"), value: closest === null ? "—" : `${formatNumber(closest, locale)} km` },
                { label: shell("statFound"), value: shell(found ? "yes" : "no"), tone: found ? "hit" : "miss" },
              ]}
              review={review}
            >
              {children}
            </ResultCard>
            {slides.length > 1 && (
              <figure className="gallery-strip">
                <figcaption>
                  <span className="eyebrow">{t("galleryTitle")}</span>
                  <span className="eyebrow">{t("galleryCount", { n: slides.length })}</span>
                </figcaption>
                <ul>
                  {slides.map((slide, i) => (
                    <li key={slide.src}>
                      <button
                        type="button"
                        className="gallery-thumb"
                        onClick={() => setViewing(i)}
                        aria-label={t("galleryOpen", { n: i + 1, total: slides.length })}
                        aria-haspopup="dialog"
                      >
                        <Image src={slide.src} alt={slide.alt} width={slide.width} height={slide.height} sizes="120px" />
                      </button>
                    </li>
                  ))}
                </ul>
              </figure>
            )}
            <figure className="life">
              <figcaption>
                <span className="eyebrow">{shell("onTheMap")}</span>
              </figcaption>
              {map}
            </figure>
            <ReadMore
              text={site.extract[locale] ?? site.extract.en}
              href={site.wiki[locale] ?? site.wiki.en}
              credit={siteT("photoCredit")}
            />
            <ImageCredit
              credit={site.image.credit}
              labels={{
                kind: t("creditPhoto"),
                publicDomain: t("creditPublicDomain"),
                unknownAuthor: t("creditUnknown"),
                source: t("creditSource"),
              }}
            />
          </div>
        ) : (
          <>
            <Plaque
              eyebrow={shell("plaqueDig")}
              text={t("question")}
              tone={last ? tone(last.km) : undefined}
              status={
                last && (
                  <>
                    <b>{heatName(last.km)}</b> {t("kmAway", { km: formatNumber(last.km, locale) })}
                  </>
                )
              }
            />
            {map}
            <div className="controls action-bar">
              <p className="hint">{last ? t("ringHint") : t("firstHint", { n: maxDigs })}</p>
              <button type="button" className="button" disabled={!pin} onClick={dig}>
                {t("digHere")}
              </button>
            </div>
          </>
        )}
      </section>

      {over && (
        <Lightbox
          images={slides}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          labels={{
            title: t("galleryDialog", { name: site.name[locale] }),
            close: t("galleryClose"),
            previous: t("galleryPrevious"),
            next: t("galleryNext"),
            position: (n, total) => t("galleryPosition", { n, total }),
            credit: {
              kind: t("creditPhoto"),
              publicDomain: t("creditPublicDomain"),
              unknownAuthor: t("creditUnknown"),
              source: t("creditSource"),
            },
          }}
        />
      )}
    </main>
  );
}

function ZoomIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
