"use client";

import { CountryPicker } from "@/components/country-picker";
import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ReviewRow } from "@/components/play/result-card";
import { WorldMap, useMapLabels, type MapMarker, type MapRegion, type MapRoute } from "@/components/world-map";
import { cornersOf, countryById, shortestRoute, type Country } from "@/lib/countries";
import { useShellT } from "@/lib/shell-messages";
import { useGameT, type MessageKey } from "./messages";
import {
  BORDERED,
  PASS,
  SPARE,
  fewestBetween,
  isSolved,
  maxGuesses,
  scoreOf,
  verdictOf,
  type Puzzle,
  type Verdict,
} from "./rules";

type BoardProps = {
  puzzle: Puzzle;
  guesses: string[];
  onGuess: (id: string) => void;
  /** Adds several guesses at once (giving up passes every guess that is left). */
  onGuesses: (ids: string[]) => void;
  /** Guesses allowed beyond the fewest that could do it. */
  spare?: number;
  /** The line above the title: "No. 12 — Today's crossing", "Stage 3 of 8 — Overland". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

const METER_STATE: Record<Verdict, string> = { on: "hit", near: "near", off: "miss" };

/** One Overland puzzle. The guesses live with whoever renders it. */
export function OverlandBoard({ puzzle, guesses, onGuess, onGuesses, spare = SPARE, label, children }: BoardProps) {
  const { locale, t } = useGameT();
  const shell = useShellT();
  const mapLabels = useMapLabels();

  const from = countryById(puzzle.from);
  const to = countryById(puzzle.to);
  if (!from || !to) return null;

  const max = maxGuesses(puzzle, spare);
  const fewest = fewestBetween(puzzle);
  const solved = isSolved(puzzle, guesses);
  const over = solved || guesses.length >= max;

  const guessed = guesses
    .map((id) => countryById(id))
    .filter((country): country is Country => country !== undefined)
    .map((country) => ({ country, verdict: verdictOf(puzzle, country.id) }));
  const onTheWay = guessed.filter((entry) => entry.verdict === "on").length;

  // Once it is over the map shows a shortest way, through as many of the
  // player's own countries as one can pass.
  const way = over
    ? shortestRoute(puzzle.from, puzzle.to, new Set(guesses))
        .map((id) => countryById(id))
        .filter((country): country is Country => country !== undefined)
    : [];

  const taken = new Set([puzzle.from, puzzle.to, ...guesses]);
  const regions: MapRegion[] = [
    ...way.filter((country) => !taken.has(country.id)).flatMap((country) => shapesOf(country, "way")),
    ...guessed.flatMap(({ country, verdict }) => shapesOf(country, verdict)),
    ...shapesOf(from, "end"),
    ...shapesOf(to, "end"),
  ];

  const markers: MapMarker[] = [
    ...guessed.map(
      ({ country, verdict }, i): MapMarker => ({
        lat: country.lat,
        lon: country.lon,
        kind: "guess",
        badge: String(i + 1),
        tone: verdict,
        label: country.name[locale],
      }),
    ),
    { lat: from.lat, lon: from.lon, kind: "ghost", label: from.name[locale] },
    { lat: to.lat, lon: to.lon, kind: "answer", label: to.name[locale] },
  ];

  const routes: MapRoute[] = over ? [{ points: way, kind: "route", draw: true, id: "way" }] : [];

  const question = t("question", { from: from.name[locale], to: to.name[locale] });
  const last = guessed.at(-1);

  // The map frames the two ends and the guesses that lead somewhere. A guess
  // that went astray is framed too while it is the latest, so it can be seen.
  // Once it is over, every guess stays in the frame.
  const framed = over ? guessed : guessed.filter((entry) => entry.verdict !== "off" || entry === last);

  const pips: Pip[] = Array.from({ length: max }, (_, i) => {
    const id = guesses[i];
    if (id === undefined) return i === guesses.length && !over ? "current" : "todo";
    if (id === PASS) return "skip";
    return METER_STATE[verdictOf(puzzle, id)] as Pip;
  });
  const review: ReviewRow[] = guesses.map((id, i) => {
    const country = countryById(id);
    const verdict = verdictOf(puzzle, id);
    return {
      id: `${i}-${id}`,
      label: shell("tryN", { n: i + 1 }),
      verdict: !country ? "skip" : verdict === "on" ? "hit" : verdict === "near" ? "near" : "miss",
      yours: country ? country.name[locale] : shell("gaveUp"),
      value: country ? t(`verdict_${verdict}` as MessageKey) : undefined,
    };
  });
  const map = (
    <WorldMap
      markers={markers}
      regions={regions}
      routes={routes}
      focus={[...cornersOf(from), ...cornersOf(to), ...framed.map((entry) => entry.country)]}
      labels={mapLabels}
      ariaLabel={t("mapAria")}
    />
  );
  const title = question.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));

  return (
    <main className="game" data-game="overland" data-summary={over ? "" : undefined}>
      <Hud
        step={{ n: Math.min(guesses.length + 1, max), total: max, kind: "try" }}
        pips={pips}
        stats={[{ icon: "flag", label: t("clueOnWay"), value: onTheWay }]}
        onGiveUp={() => onGuesses(Array.from({ length: max - guesses.length }, () => PASS))}
        over={over}
      />

      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          {over && <h1 className="dossier-name">{title}</h1>}
          <p className={over ? "dossier-description" : "dossier-lead"}>{t("lead")}</p>
        </div>

        <ul className="clues">
          <li>
            <span>{t("clueFewest")}</span>
            <b>{fewest === 1 ? t("clueFewestOne") : t("clueFewestValue", { n: fewest })}</b>
          </li>
          <li>
            <span>{t("clueOnWay")}</span>
            <b>{onTheWay}</b>
          </li>
          <li>
            <span>{t("clueLeft")}</span>
            <b>{over ? "—" : max - guesses.length}</b>
          </li>
        </ul>
      </aside>

      <section className="stage">
        {over ? (
          <div className="summary">
            <ResultCard
              label={label}
              headline={
                !solved ? t("lost") : guesses.length === fewest ? t("solvedShortest") : t("solvedIn", { n: guesses.length })
              }
              answer={`${t("theWay")}: ${way.map((country) => country.name[locale]).join(" → ")}`}
              points={scoreOf(puzzle, guesses, spare).points}
              stats={[
                {
                  label: shell("statTries"),
                  value: `${solved ? guesses.length : "X"}/${max}`,
                  tone: solved ? "hit" : "miss",
                },
                { label: shell("statOnTheWay"), value: onTheWay },
                { label: t("clueFewest"), value: fewest },
              ]}
              review={review}
            >
              {children}
            </ResultCard>
            <figure className="life">
              <figcaption>
                <span className="eyebrow">{shell("onTheMap")}</span>
              </figcaption>
              {map}
            </figure>
          </div>
        ) : (
          <>
            <Plaque
              eyebrow={shell("plaqueCrossing")}
              text={question}
              as="h1"
              tone={last?.verdict}
              status={
                last ? (
                  <>
                    <b>{t(`verdict_${last.verdict}` as MessageKey)}</b> {last.country.name[locale]}
                  </>
                ) : undefined
              }
            />
            {map}
            {!last && <p className="hint">{t("firstHint", { n: max })}</p>}
            <CountryPicker
              pool={BORDERED}
              taken={taken}
              onSubmit={onGuess}
              labels={{
                placeholder: t("searchPlaceholder"),
                search: t("searchLabel"),
                submit: t("guess"),
                noMatch: t("noMatch"),
              }}
            />
            {guessed.length > 0 && (
              <ol className="tries" reversed>
                {guessed
                  .map(({ country, verdict }, i) => (
                    <li key={country.id} data-state={METER_STATE[verdict]} data-tone={verdict}>
                      <span className="tries-n">{i + 1}</span>
                      <span className="tries-name">{country.name[locale]}</span>
                      <span className="tries-hint">{t(`hint_${verdict}` as MessageKey)}</span>
                    </li>
                  ))
                  .reverse()}
              </ol>
            )}
          </>
        )}
      </section>
    </main>
  );
}

const shapesOf = (country: Country, tone: string): MapRegion[] =>
  country.shapes.map((shape) => ({ shape, tone }));
