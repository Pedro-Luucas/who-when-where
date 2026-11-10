"use client";

import { CountryPicker } from "@/components/country-picker";
import { Daily } from "@/components/daily";
import { GamePanels } from "@/components/game-panels";
import { ResultActions } from "@/components/result-footer";
import { WorldMap, useMapLabels, type MapMarker, type MapRegion, type MapRoute } from "@/components/world-map";
import { cornersOf, countryById, shortestRoute, type Country } from "@/lib/countries";
import { useSiteT } from "@/lib/i18n";
import { useGameT, type MessageKey } from "./messages";
import { BORDERED, SPARE, fewestBetween, isSolved, maxGuesses, verdictOf, type Puzzle, type Verdict } from "./rules";
import { shareText } from "./share";
import { computeStats, puzzleOf, useSave } from "./store";

export function Overland() {
  // Keyed by day: at midnight the next puzzle starts from a clean slate.
  return <Daily>{(day) => <Play key={day} day={day} />}</Daily>;
}

function Play({ day }: { day: number }) {
  const [save, setSave] = useSave();
  const { t } = useGameT();
  const siteT = useSiteT();

  const { puzzle, guesses } = puzzleOf(save, day);
  const stats = computeStats(save, day);

  function guess(id: string) {
    setSave((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [day]: { ...puzzle, guesses: [...puzzleOf(previous, day).guesses, id] },
      },
    }));
  }

  return (
    <>
      <OverlandBoard
        puzzle={puzzle}
        guesses={guesses}
        onGuess={guess}
        label={`${siteT("puzzleNo", { n: day })} — ${t("kicker")}`}
      >
        <ResultActions path="/overland" shareText={(url) => shareText(day, puzzle, guesses, url)} />
      </OverlandBoard>
      <GamePanels
        game="overland"
        help={[t("help1"), t("help2"), t("help3"), t("help4"), t("help5")]}
        seenHelp={save.seenHelp}
        onSeenHelp={() => setSave((previous) => ({ ...previous, seenHelp: true }))}
        played={stats.played}
        tiles={[
          { label: siteT("statPlayed"), value: stats.played },
          { label: t("statArrived"), value: `${stats.arrivedRate}%` },
          { label: t("statShortest"), value: stats.shortest },
          { label: siteT("statStreak"), value: stats.streak },
          { label: siteT("statLongest"), value: stats.longestStreak },
        ]}
      />
    </>
  );
}

type BoardProps = {
  puzzle: Puzzle;
  guesses: string[];
  onGuess: (id: string) => void;
  /** Guesses allowed beyond the fewest that could do it. */
  spare?: number;
  /** The line above the title: "No. 12 — Today's crossing", "Stage 3 of 8 — Overland". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

const METER_STATE: Record<Verdict, string> = { on: "hit", near: "near", off: "miss" };

/** One Overland puzzle. The guesses live with whoever renders it. */
export function OverlandBoard({ puzzle, guesses, onGuess, spare = SPARE, label, children }: BoardProps) {
  const { locale, t } = useGameT();
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
  const framed = guessed.filter((entry) => entry.verdict !== "off" || (entry === last && !over));

  return (
    <main className="game" data-game="overland" data-summary={over ? "" : undefined}>
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <h1 className="dossier-name">
            {question.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part))}
          </h1>
          <p className="dossier-description">{t("lead")}</p>
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

        <ol className="meter" aria-label={`${guesses.length}/${max}`}>
          {Array.from({ length: max }, (_, i) => {
            const entry = guessed[i];
            const state = entry ? METER_STATE[entry.verdict] : i === guesses.length && !over ? "current" : "todo";
            return <li key={i} data-state={state} />;
          })}
        </ol>
      </aside>

      <section className="stage">
        {over && (
          <div className="result-head" role="status">
            <div className="stamp" data-lost={solved ? undefined : ""}>
              <strong>
                {solved ? guesses.length : "×"}/{max}
              </strong>
              <span>{t("guesses")}</span>
            </div>
            <div className="verdict-text">
              <p className="verdict-headline">
                {!solved
                  ? t("lost")
                  : guesses.length === fewest
                    ? t("solvedShortest")
                    : t("solvedIn", { n: guesses.length })}
              </p>
              <p className="verdict-answer">
                {t("theWay")}: {way.map((country) => country.name[locale]).join(" → ")}
              </p>
            </div>
          </div>
        )}

        <WorldMap
          markers={markers}
          regions={regions}
          routes={routes}
          focus={[...cornersOf(from), ...cornersOf(to), ...framed.map((entry) => entry.country)]}
          labels={mapLabels}
          ariaLabel={t("mapAria")}
        />

        {over ? (
          <div className="summary">{children}</div>
        ) : (
          <>
            {last ? (
              <p className="feedback" data-tone={last.verdict} role="status">
                <b>{t(`verdict_${last.verdict}` as MessageKey)}</b> {last.country.name[locale]}
              </p>
            ) : (
              <p className="hint">{t("firstHint", { n: max })}</p>
            )}
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
          </>
        )}

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
      </section>
    </main>
  );
}

const shapesOf = (country: Country, tone: string): MapRegion[] =>
  country.shapes.map((shape) => ({ shape, tone }));
