"use client";

import { useEffect, useState } from "react";
import { WorldMap, type MapArc, type MapMarker } from "@/components/world-map";
import { useSecondsUntilTomorrow } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { useGameT } from "./messages";
import { placeLabel, type Person } from "./people";
import { useMapLabels } from "./place-round";
import { ROUND_MAX, ROUNDS, TOTAL_MAX, rankOf, totalScore, type Guess } from "./rules";
import { copyText, shareText } from "./share";

type Props = { person: Person; day: number; guesses: Guess[] };

function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const clock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

export function Summary({ person, day, guesses }: Props) {
  const { locale, t } = useGameT();
  const mapLabels = useMapLabels();
  const total = totalScore(guesses);
  const shown = useCountUp(total);
  const secondsLeft = useSecondsUntilTomorrow();
  const [copied, setCopied] = useState(false);

  const { birth, death } = person;
  const samePlace = birth.place.lat === death.place.lat && birth.place.lon === death.place.lon;

  // The life arc: birthplace to deathplace, with the player's pins for reference.
  const markers: MapMarker[] = [];
  const arcs: MapArc[] = [];
  ROUNDS.forEach((round, i) => {
    const guess = guesses[i];
    if (guess.kind !== "place") return;
    markers.push({ lat: guess.lat, lon: guess.lon, kind: "guess" });
    arcs.push({ from: guess, to: person[round.event].place, kind: "miss" });
  });
  if (samePlace) {
    markers.push({
      ...birth.place,
      kind: "answer",
      label: `${birth.place.name[locale]} ${birth.year}–${death.year}`,
    });
  } else {
    arcs.push({ from: birth.place, to: death.place, kind: "life" });
    // Labels on opposite sides, so two nearby towns stay readable.
    markers.push({
      ...birth.place,
      kind: "answer",
      label: `${birth.place.name[locale]} ${birth.year}`,
      labelBelow: true,
    });
    markers.push({
      ...death.place,
      kind: "answer",
      label: `${death.place.name[locale]} ${death.year}`,
      labelBelow: false,
    });
  }

  async function share() {
    const url = `${window.location.origin}/who-when-where`;
    if (await copyText(shareText(day, guesses, locale, url))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  }

  const extract = person.extract[locale] ?? person.extract.en;
  const article = person.wiki[locale] ?? person.wiki.en;

  return (
    <div className="summary">
      <header className="summary-score">
        <p className="eyebrow">{t("resultTitle")}</p>
        <p className="summary-total">
          <strong>{formatNumber(shown, locale)}</strong>
          <span>/ {formatNumber(TOTAL_MAX, locale)}</span>
        </p>
        <p className="summary-rank">{t(`rank${rankOf(total)}`)}</p>
      </header>

      <ol className="breakdown">
        {ROUNDS.map((round, i) => {
          const guess = guesses[i];
          const event = person[round.event];
          return (
            <li key={round.id} style={{ animationDelay: `${150 + i * 110}ms` }}>
              <span className="breakdown-label">{t(`r_${round.id}`)}</span>
              <span className="breakdown-answer">
                {round.kind === "place" ? placeLabel(event.place, locale) : event.year}
              </span>
              <span className="breakdown-detail">
                {guess.kind === "place"
                  ? `${formatNumber(guess.km, locale)} km`
                  : guess.diff === 0
                    ? "="
                    : `±${guess.diff}`}
              </span>
              <span className="breakdown-bar" aria-hidden="true">
                <i style={{ width: `${(guess.score / ROUND_MAX) * 100}%` }} />
              </span>
              <span className="breakdown-score">{guess.score}</span>
            </li>
          );
        })}
      </ol>

      <div className="summary-actions">
        <button type="button" className="button" onClick={share}>
          {copied ? t("copied") : t("share")}
        </button>
        <p className="countdown">
          <span>{t("nextIn")}</span>
          <time>{clock(secondsLeft)}</time>
        </p>
      </div>

      <figure className="life">
        <figcaption>
          <span className="eyebrow">{t("lifeArc")}</span>
          <span className="life-span">{t("lived", { n: death.year - birth.year })}</span>
        </figcaption>
        <WorldMap
          markers={markers}
          arcs={arcs}
          focus={[birth.place, death.place]}
          labels={mapLabels}
          ariaLabel={t("lifeArc")}
        />
      </figure>

      <article className="bio">
        <p>{extract}</p>
        <p className="bio-links">
          <a href={article} target="_blank" rel="noreferrer">
            {t("readMore")} →
          </a>
          <span>{t("portraitCredit")}</span>
        </p>
      </article>
    </div>
  );
}
