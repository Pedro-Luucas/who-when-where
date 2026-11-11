"use client";

import { ResultCard, type ReviewRow, type Verdict } from "@/components/play/result-card";
import { ReadMore } from "@/components/result-footer";
import { WorldMap, useMapLabels, type MapArc, type MapMarker } from "@/components/world-map";
import { formatNumber } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { useGameT } from "./messages";
import { placeLabel, type Person } from "./people";
import { ROUND_MAX, ROUNDS, rankOf, totalScore, type Guess } from "./rules";

type Props = {
  person: Person;
  guesses: Guess[];
  /** The line above the verdict: "No. 12 — Today's mind". */
  label: string;
  /** What follows the score: sharing, or the way onwards. */
  children?: React.ReactNode;
};

const verdictOf = (score: number): Verdict =>
  score >= ROUND_MAX * 0.8 ? "hit" : score >= ROUND_MAX * 0.4 ? "near" : "miss";

/** A finished Who When Where: the result card, then the life on the map with every pin, then the story. */
export function Summary({ person, guesses, label, children }: Props) {
  const { locale, t } = useGameT();
  const shell = useShellT();
  const mapLabels = useMapLabels();
  const total = totalScore(guesses);

  const { birth, death } = person;
  const samePlace = birth.place.lat === death.place.lat && birth.place.lon === death.place.lon;

  // The life arc: birthplace to deathplace, with the player's pins for reference.
  const markers: MapMarker[] = [];
  const arcs: MapArc[] = [];
  const pins: { lat: number; lon: number }[] = [];
  ROUNDS.forEach((round, i) => {
    const guess = guesses[i];
    if (guess.kind !== "place") return;
    markers.push({ lat: guess.lat, lon: guess.lon, kind: "guess" });
    arcs.push({ from: guess, to: person[round.event].place, kind: "miss" });
    pins.push(guess);
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

  const places = guesses.filter((guess) => guess.kind === "place");
  const years = guesses.filter((guess) => guess.kind === "year");
  const sum = (list: Guess[]) => list.reduce((acc, guess) => acc + guess.score, 0);
  const max = (list: Guess[]) => formatNumber(list.length * ROUND_MAX, locale);

  const review: ReviewRow[] = ROUNDS.map((round, i) => {
    const guess = guesses[i];
    const event = person[round.event];
    return {
      id: round.id,
      label: t(`r_${round.id}`),
      verdict: verdictOf(guess.score),
      yours:
        guess.kind === "place"
          ? shell("kmOff", { km: formatNumber(guess.km, locale) })
          : guess.diff === 0
            ? `${guess.year} ✓`
            : `${guess.year} (±${guess.diff})`,
      right: round.kind === "place" ? placeLabel(event.place, locale) : event.year,
      value: `+${guess.score}`,
    };
  });

  const extract = person.extract[locale] ?? person.extract.en;
  const article = person.wiki[locale] ?? person.wiki.en;

  return (
    <div className="summary">
      <ResultCard
        label={label}
        headline={t(`rank${rankOf(total)}`)}
        answer={`${person.name[locale]} · ${birth.year}–${death.year}`}
        points={total}
        stats={[
          { label: shell("statPlaces"), value: `${formatNumber(sum(places), locale)}/${max(places)}` },
          { label: shell("statYears"), value: `${formatNumber(sum(years), locale)}/${max(years)}` },
          {
            label: shell("statClosest"),
            value: places.length ? `${formatNumber(Math.min(...places.map((guess) => guess.km)), locale)} km` : "—",
          },
        ]}
        review={review}
      >
        {children}
      </ResultCard>

      <figure className="life">
        <figcaption>
          <span className="eyebrow">{t("lifeArc")}</span>
          <span className="life-span">{t("lived", { n: death.year - birth.year })}</span>
        </figcaption>
        <WorldMap
          markers={markers}
          arcs={arcs}
          // The player's own pins stay in the frame with the life itself.
          focus={[birth.place, death.place, ...pins]}
          labels={mapLabels}
          ariaLabel={t("lifeArc")}
        />
      </figure>

      <ReadMore text={extract} href={article} credit={t("portraitCredit")} />
    </div>
  );
}
