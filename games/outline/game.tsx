"use client";

import { CountryPicker } from "@/components/country-picker";
import { ResultHead } from "@/components/result-head";
import { WorldMap, useMapLabels, type MapMarker, type MapRegion } from "@/components/world-map";
import { COUNTRIES, cornersOf, countryById, type Country } from "@/lib/countries";
import { formatNumber } from "@/lib/i18n";
import { useGameT, type MessageKey } from "./messages";
import {
  BORDERS_CLUE_AT,
  HEMISPHERE_CLUE_AT,
  MAX_GUESSES,
  SIZE_CLUE_AT,
  closenessOf,
  isSolved,
  readingOf,
  type Reading,
} from "./rules";
import { Silhouette } from "./silhouette";

const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

type BoardProps = {
  country: Country;
  guesses: string[];
  onGuess: (id: string) => void;
  maxGuesses?: number;
  /** The line above the title: "No. 12 — Today's outline", "Stage 3 of 8 — Outline". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

/** A size a player can picture: two significant figures. */
function roundedArea(km2: number): number {
  const scale = 10 ** Math.max(Math.floor(Math.log10(km2)) - 1, 0);
  return Math.round(km2 / scale) * scale;
}

/** One Outline puzzle. The guesses live with whoever renders it. */
export function OutlineBoard({ country, guesses, onGuess, maxGuesses = MAX_GUESSES, label, children }: BoardProps) {
  const { locale, t } = useGameT();
  const mapLabels = useMapLabels();

  const used = guesses.length;
  const solved = isSolved(country.id, guesses);
  const over = solved || used >= maxGuesses;

  const readings = guesses
    .map((id) => readingOf(country, id))
    .filter((reading): reading is Reading => reading !== null);
  const misses = readings.filter((reading) => !reading.hit);
  const closest = misses.length ? Math.min(...misses.map((reading) => reading.km)) : 0;
  const last = readings.at(-1);

  const tone = (reading: Reading) => `heat-${reading.heat}`;
  const heatName = (reading: Reading) => t(`heat${reading.heat}` as MessageKey);

  const regions: MapRegion[] = misses.flatMap((reading) =>
    reading.country.shapes.map((shape) => ({ shape, tone: tone(reading) })),
  );
  const markers: MapMarker[] = misses.map((reading) => ({
    lat: reading.country.lat,
    lon: reading.country.lon,
    kind: "guess",
    badge: String(readings.indexOf(reading) + 1),
    tone: tone(reading),
    label: reading.country.name[locale],
  }));
  if (over) {
    regions.push(...country.shapes.map((shape) => ({ shape, tone: "answer" })));
    markers.push({ lat: country.lat, lon: country.lon, kind: "answer", label: country.name[locale] });
  }

  const area = `${formatNumber(roundedArea(country.area), locale)} km²`;
  const neighbours = country.borders
    .map((id) => countryById(id)?.name[locale])
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b, locale));
  const borderCount =
    neighbours.length === 0
      ? t("bordersNone")
      : neighbours.length === 1
        ? t("bordersOne")
        : t("bordersMany", { n: neighbours.length });

  const clues = [
    {
      label: t("clueHemisphere"),
      value: `${t(country.lat >= 0 ? "north" : "south")} · ${t(country.lon >= 0 ? "east" : "west")}`,
      at: HEMISPHERE_CLUE_AT,
    },
    { label: t("clueSize"), value: area, at: SIZE_CLUE_AT },
    { label: t("clueBorders"), value: borderCount, at: BORDERS_CLUE_AT },
  ];

  return (
    <main className="game" data-game="outline" data-summary={over ? "" : undefined}>
      <aside className="dossier">
        <Silhouette country={country} revealed={over} label={over ? country.name[locale] : t("silhouetteAria")} />

        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <h1 className="dossier-name">{over ? country.name[locale] : t("mystery")}</h1>
          <p className="dossier-description">{t("lead")}</p>
        </div>

        {!over && (
          <ul className="clues">
            {clues.map((clue) => (
              <li key={clue.label} data-locked={used < clue.at ? "" : undefined}>
                <span>{clue.label}</span>
                <b>{used >= clue.at ? clue.value : clue.at < maxGuesses ? t("unlockAt", { n: clue.at }) : "—"}</b>
              </li>
            ))}
          </ul>
        )}

        <ol className="meter" aria-label={`${used}/${maxGuesses}`}>
          {Array.from({ length: maxGuesses }, (_, i) => {
            const reading = readings[i];
            const state = reading ? (reading.hit ? "hit" : "miss") : i === used && !over ? "current" : "todo";
            return <li key={i} data-state={state} data-tone={reading && !reading.hit ? tone(reading) : undefined} />;
          })}
        </ol>
      </aside>

      <section className="stage">
        {over ? (
          <ResultHead
            solved={solved}
            used={used}
            max={maxGuesses}
            unit={t("guesses")}
            headline={!solved ? t("lost") : used === 1 ? t("solvedFirst") : t("solvedIn", { n: used })}
          >
            {country.name[locale]}
            {!solved && ` · ${t("lostDetail", { km: formatNumber(closest, locale) })}`}
          </ResultHead>
        ) : (
          <h2 className="question">
            {t("question")
              .split("*")
              .map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
          </h2>
        )}

        <WorldMap
          markers={markers}
          regions={regions}
          focus={
            over
              ? [...cornersOf(country), ...misses.filter((reading) => reading.heat <= 2).map((reading) => reading.country)]
              : misses.map((reading) => reading.country)
          }
          labels={mapLabels}
          ariaLabel={t("mapAria")}
        />

        {over ? (
          <div className="summary">
            {children}
            <dl className="facts">
              <div>
                <dt>{t("factArea")}</dt>
                <dd>{area}</dd>
              </div>
              <div>
                <dt>{neighbours.length ? t("factBorders") : t("clueBorders")}</dt>
                <dd>{neighbours.length ? neighbours.join(", ") : t("factIsland")}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <>
            {last ? (
              <p className="feedback" data-tone={tone(last)} role="status">
                <b>{heatName(last)}</b> {t("kmAway", { km: formatNumber(last.km, locale) })}{" "}
                <span aria-hidden="true">{ARROWS[last.direction]}</span>
              </p>
            ) : (
              <p className="hint">{t("firstHint")}</p>
            )}
            <CountryPicker
              pool={COUNTRIES}
              taken={new Set(guesses)}
              onSubmit={onGuess}
              labels={{
                placeholder: t("searchPlaceholder"),
                search: t("searchLabel"),
                submit: t("guess"),
                noMatch: t("noMatch"),
              }}
            />
          </>
        )}

        {readings.length > 0 && (
          <ol className="tries" reversed>
            {readings
              .map((reading, i) => (
                <li
                  key={reading.country.id}
                  data-state={reading.hit ? "hit" : "miss"}
                  data-tone={reading.hit ? undefined : tone(reading)}
                >
                  <span className="tries-n">{i + 1}</span>
                  <span className="tries-name">{reading.country.name[locale]}</span>
                  {!reading.hit && (
                    <span className="tries-hint">
                      <i aria-hidden="true">{ARROWS[reading.direction]}</i>{" "}
                      {t("kmAway", { km: formatNumber(reading.km, locale) })} ·{" "}
                      {t("closeness", { n: closenessOf(reading.km) })}
                    </span>
                  )}
                </li>
              ))
              .reverse()}
          </ol>
        )}
      </section>
    </main>
  );
}
