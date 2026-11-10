"use client";

import { useState } from "react";
import { Daily } from "@/components/daily";
import { GamePanels } from "@/components/game-panels";
import { ReadMore, ResultActions } from "@/components/result-footer";
import { WorldMap, useMapLabels, type MapMarker, type MapRoute } from "@/components/world-map";
import { formatYear, useSiteT } from "@/lib/i18n";
import {
  JOURNEYS,
  journeyById,
  journeyForDay,
  routeSlice,
  stopsWithin,
  type Journey,
} from "./journeys";
import { centuryLabel, useGameT, type MessageKey } from "./messages";
import {
  CENTURY_CLUE_AT,
  MAX_GUESSES,
  MODE_CLUE_AT,
  NAMES_CLUE_AT,
  hintFor,
  isSolved,
  revealAt,
  type Guess,
} from "./rules";
import { shareText } from "./share";
import { computeStats, useSave } from "./store";

export function Wayfarer() {
  // Keyed by day: at midnight the next puzzle starts from a clean slate.
  return <Daily>{(day) => <Play key={day} day={day} />}</Daily>;
}

// "Tânger" matches "tanger".
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function Play({ day }: { day: number }) {
  const [save, setSave] = useSave();
  const { t } = useGameT();
  const siteT = useSiteT();

  // A saved record names its journey, so a roster change can't reassign it.
  const stored = save.days[day];
  const record = stored && journeyById(stored.journeyId) ? stored : undefined;
  const journey = (record && journeyById(record.journeyId)) ?? journeyForDay(day);
  const guesses = record?.guesses ?? [];
  const stats = computeStats(save, day);

  function guess(next: Guess) {
    setSave((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [day]: {
          journeyId: journey.id,
          guesses: [...(previous.days[day]?.guesses ?? []), next],
        },
      },
    }));
  }

  return (
    <>
      <WayfarerBoard
        journey={journey}
        guesses={guesses}
        onGuess={guess}
        label={`${siteT("puzzleNo", { n: day })} — ${t("kicker")}`}
      >
        <ResultActions path="/wayfarer" shareText={(url) => shareText(day, journey.id, guesses, url)} />
      </WayfarerBoard>
      <GamePanels
        game="wayfarer"
        help={[t("help1"), t("help2"), t("help3"), t("help4"), t("help5")]}
        seenHelp={save.seenHelp}
        onSeenHelp={() => setSave((previous) => ({ ...previous, seenHelp: true }))}
        played={stats.played}
        tiles={[
          { label: siteT("statPlayed"), value: stats.played },
          { label: t("statSolved"), value: `${stats.solvedRate}%` },
          { label: t("statAverage"), value: stats.averageTries },
          { label: siteT("statStreak"), value: stats.streak },
          { label: siteT("statLongest"), value: stats.longestStreak },
        ]}
      />
    </>
  );
}

type BoardProps = {
  journey: Journey;
  guesses: Guess[];
  onGuess: (guess: Guess) => void;
  maxGuesses?: number;
  /** The line above the title: "No. 12 — Today's journey", "Stage 3 of 8 — Wayfarer". */
  label: string;
  /** What follows the result once the puzzle is over: sharing, or the way onwards. */
  children?: React.ReactNode;
};

/** One Wayfarer puzzle. The guesses live with whoever renders it. */
export function WayfarerBoard({ journey, guesses, onGuess, maxGuesses = MAX_GUESSES, label, children }: BoardProps) {
  const { locale, t } = useGameT();
  const mapLabels = useMapLabels();
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<string | null>(null);

  const used = guesses.length;
  const solved = isSolved(journey.id, guesses);
  const over = solved || used >= maxGuesses;

  function submit(guess: Guess) {
    if (over) return;
    onGuess(guess);
    setQuery("");
    setChoice(null);
  }

  // How much of the route is on the map, and how much of that is new since
  // the last guess (the new stretch is drawn with a flourish).
  const shown = over ? 1 : revealAt(used, maxGuesses);
  const before = used === 0 ? 0 : revealAt(used - 1, maxGuesses);
  const { stops } = journey;
  const routes: MapRoute[] = [];
  if (before > 0) routes.push({ points: routeSlice(stops, 0, before), kind: "route" });
  if (shown > before) {
    routes.push({
      points: routeSlice(stops, before, shown),
      kind: "route",
      draw: true,
      id: `stretch-${used}-${over}`,
    });
  }

  const visible = routeSlice(stops, 0, shown);
  const showNames = over || used >= NAMES_CLUE_AT;
  const markers: MapMarker[] = [];
  if (showNames) {
    // Labels alternate above and below, so neighbouring stops stay readable.
    stopsWithin(stops, shown)
      .filter((stop) => stop.name)
      .forEach((stop, i) => {
        markers.push({ ...stop, kind: "stop", label: stop.name?.[locale], labelBelow: i % 2 === 1 });
      });
  } else {
    markers.push({ ...stops[0], kind: "ghost", label: t("start") });
  }
  // Where the line stops for now.
  if (!over) markers.push({ ...visible[visible.length - 1], kind: "answer" });

  const options = JOURNEYS.map((entry) => ({ id: entry.id, label: entry.name[locale] })).sort(
    (a, b) => a.label.localeCompare(b.label, locale),
  );
  const matches = options.filter((option) => fold(option.label).includes(fold(query.trim())));
  const tried = new Set(guesses);
  // Typing down to a single journey is as good as tapping it.
  const open = matches.filter((option) => !tried.has(option.id));
  const picked = choice ?? (query.trim() && open.length === 1 ? open[0].id : null);

  const years =
    journey.start === journey.end
      ? formatYear(journey.start, locale)
      : `${formatYear(journey.start, locale)}–${formatYear(journey.end, locale)}`;
  const mode = t(`mode_${journey.mode}` as MessageKey);

  const clues = [
    { label: t("clueMode"), value: mode, at: MODE_CLUE_AT },
    { label: t("clueCentury"), value: centuryLabel(journey.start, locale), at: CENTURY_CLUE_AT },
    { label: t("clueStops"), value: t("clueStopsOn"), at: NAMES_CLUE_AT },
  ];

  return (
    <main className="game" data-game="wayfarer" data-summary={over ? "" : undefined}>
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <h1 className="dossier-name">{over ? journey.name[locale] : t("question")}</h1>
          <p className="dossier-description">
            {over ? mode : t("lead")}
            {over && <span className="dossier-dates">{years}</span>}
          </p>
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
          {Array.from({ length: maxGuesses }, (_, i) => (
            <li key={i} data-state={meterState(guesses[i], journey.id, i === used && !over)} />
          ))}
        </ol>
      </aside>

      <section className="stage">
        {over && (
          <div className="result-head" role="status">
            <div className="stamp" data-lost={solved ? undefined : ""}>
              <strong>
                {solved ? used : "×"}/{maxGuesses}
              </strong>
              <span>{t("tries")}</span>
            </div>
            <div className="verdict-text">
              <p className="verdict-headline">
                {!solved ? t("lost") : used === 1 ? t("solvedFirst") : t("solvedIn", { n: used })}
              </p>
              <p className="verdict-answer">
                {journey.name[locale]} · {years}
              </p>
            </div>
          </div>
        )}

        <WorldMap
          markers={markers}
          routes={routes}
          focus={over ? stops : visible}
          labels={mapLabels}
          ariaLabel={t("mapAria")}
        />

        {over ? (
          <div className="summary">
            {children}
            <ReadMore
              text={journey.extract[locale] ?? journey.extract.en}
              href={journey.wiki[locale] ?? journey.wiki.en}
            />
          </div>
        ) : (
          <form
            className="picker"
            onSubmit={(event) => {
              event.preventDefault();
              if (picked) submit(picked);
            }}
          >
            <input
              className="picker-input"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setChoice(null);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              autoComplete="off"
              spellCheck={false}
            />
            <ul className="picker-list">
              {matches.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={tried.has(option.id)}
                    aria-pressed={picked === option.id}
                    onClick={() => setChoice(option.id)}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
              {matches.length === 0 && <li className="picker-empty">{t("noMatch")}</li>}
            </ul>
            <div className="picker-actions">
              <button type="button" className="button button-quiet" onClick={() => submit(null)}>
                {t("skip")}
              </button>
              <button type="submit" className="button" disabled={!picked}>
                {t("guess")}
              </button>
            </div>
          </form>
        )}

        <Tries guesses={guesses} journey={journey} />
      </section>
    </main>
  );
}

function meterState(guess: Guess | undefined, journeyId: string, current: boolean): string {
  if (guess === undefined) return current ? "current" : "todo";
  if (guess === null) return "skip";
  return guess === journeyId ? "hit" : "miss";
}

/** The guesses so far, newest first, each with what it revealed. */
function Tries({ guesses, journey }: { guesses: Guess[]; journey: Journey }) {
  const { locale, t } = useGameT();
  if (!guesses.length) return null;

  return (
    <ol className="tries" reversed>
      {guesses
        .map((guess, i) => {
          const guessed = guess === null ? undefined : journeyById(guess);
          const hit = guess === journey.id;
          const hint = guessed && !hit ? hintFor(guessed, journey) : null;
          return (
            <li key={i} data-state={hit ? "hit" : guessed ? "miss" : "skip"}>
              <span className="tries-n">{i + 1}</span>
              <span className="tries-name">{guessed ? guessed.name[locale] : t("skipped")}</span>
              {hint && (
                <span className="tries-hint">
                  <i aria-hidden="true">{hint.direction > 0 ? "▲" : hint.direction < 0 ? "▼" : "●"}</i>{" "}
                  {hint.direction === 0
                    ? t("hintSame")
                    : `${t(hint.direction > 0 ? "hintLater" : "hintEarlier")}, ${t(`gap${hint.gap}`)}`}
                </span>
              )}
            </li>
          );
        })
        .reverse()}
    </ol>
  );
}
