"use client";

import { useState } from "react";
import { WorldMap, useMapLabels, type MapArc, type MapMarker } from "@/components/world-map";
import { formatCoordinates, type LatLon } from "@/lib/geo";
import { formatNumber } from "@/lib/i18n";
import { useFinePointer } from "@/lib/pointer";
import { useGameT } from "./messages";
import { placeLabel, type Person } from "./people";
import { Question, ScoreStamp } from "./round-parts";
import { ROUND_MAX, gradePlace, type PlaceGuess, type Round } from "./rules";

type Props = {
  person: Person;
  round: Round;
  /** The graded guess once this round is locked; null while guessing. */
  locked: PlaceGuess | null;
  onLock: (guess: PlaceGuess) => void;
  onNext: () => void;
  nextLabel: string;
};

export function PlaceRound({ person, round, locked, onLock, onNext, nextLabel }: Props) {
  const { locale, t } = useGameT();
  const mapLabels = useMapLabels();
  const mouse = useFinePointer();
  const [pin, setPin] = useState<LatLon | null>(null);

  const target = person[round.event].place;
  const markers: MapMarker[] = [];
  const arcs: MapArc[] = [];

  // By the time the death place is asked, the birthplace is already known.
  if (round.event === "death") {
    markers.push({ ...person.birth.place, kind: "ghost", label: t("born") });
  }
  if (locked) {
    markers.push({ lat: locked.lat, lon: locked.lon, kind: "guess" });
    markers.push({ lat: target.lat, lon: target.lon, kind: "answer", label: target.name[locale] });
    arcs.push({ from: locked, to: target, kind: "miss" });
  } else if (pin) {
    markers.push({ ...pin, kind: "guess" });
  }

  return (
    <>
      <Question person={person} round={round} />

      <WorldMap
        markers={markers}
        arcs={arcs}
        onPick={locked ? undefined : setPin}
        focus={locked ? [locked, target] : undefined}
        labels={mapLabels}
        ariaLabel={t(`r_${round.id}`)}
      >
        {locked ? null : pin ? (
          <>
            <b>{t("yourPin")}</b> {formatCoordinates(pin)}
          </>
        ) : (
          t(mouse ? "mapHintMouse" : "mapHint")
        )}
      </WorldMap>

      {locked ? (
        <div className="verdict action-bar" role="status">
          <ScoreStamp score={locked.score} />
          <div className="verdict-text">
            <p className="verdict-headline">
              {locked.score === ROUND_MAX
                ? t("bullseye")
                : t("kmAway", { km: formatNumber(locked.km, locale) })}
            </p>
            <p className="verdict-answer">{placeLabel(target, locale)}</p>
          </div>
          <button type="button" className="button" onClick={onNext} autoFocus>
            {nextLabel}
          </button>
        </div>
      ) : (
        <div className="controls action-bar">
          <p className="hint">{t(mouse ? "mapHintZoomMouse" : "mapHintZoom")}</p>
          <button
            type="button"
            className="button"
            disabled={!pin}
            onClick={() => pin && onLock(gradePlace(person, round, pin))}
          >
            {t("lockIn")}
          </button>
        </div>
      )}
    </>
  );
}
