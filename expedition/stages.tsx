"use client";

import { DigSiteBoard } from "@/games/dig-site/game";
import { scoreOf as digSiteScore, type Dig } from "@/games/dig-site/rules";
import { SITES, siteById, siteLabel } from "@/games/dig-site/sites";
import { eventById, eventsForSeed, type HistoryEvent } from "@/games/first-to-last/events";
import { FirstToLastBoard } from "@/games/first-to-last/game";
import { scoreOf as firstToLastScore, type Attempt } from "@/games/first-to-last/rules";
import { GAME_SLUGS, type GameSlug } from "@/games/slugs";
import { WayfarerBoard } from "@/games/wayfarer/game";
import { JOURNEYS, journeyById } from "@/games/wayfarer/journeys";
import { scoreOf as wayfarerScore, type Guess as WayfarerGuess } from "@/games/wayfarer/rules";
import { WhoWhenWhereBoard } from "@/games/who-when-where/game";
import { PEOPLE, personById } from "@/games/who-when-where/people";
import { scoreOf as whoWhenWhereScore, type Guess as LifeGuess } from "@/games/who-when-where/rules";
import { seededShuffle } from "@/lib/daily";
import { formatYear, type Locale } from "@/lib/i18n";
import type { Score } from "@/lib/points";
import type { ExpeditionSettings } from "./settings";

// The puzzles of an expedition, and how each game plays and scores one.

/** One puzzle: the game, and the ids that name it (six events for First to Last, else one). */
export type Stage = { game: GameSlug; ids: string[] };

/**
 * Deals an expedition's puzzles. Everyone who holds the same seed and settings
 * gets the same puzzles in the same order, which is what lets a party race.
 */
export function buildStages(settings: ExpeditionSettings, seed: string): Stage[] {
  const pick = (ids: string[], game: GameSlug) =>
    seededShuffle(ids, `${seed}:${game}`)
      .slice(0, settings.rounds[game])
      .map((id) => ({ game, ids: [id] }));

  const byGame: Record<GameSlug, Stage[]> = {
    "who-when-where": pick(
      PEOPLE.map((person) => person.id),
      "who-when-where",
    ),
    wayfarer: pick(
      JOURNEYS.map((journey) => journey.id),
      "wayfarer",
    ),
    "dig-site": pick(
      SITES.map((site) => site.id),
      "dig-site",
    ),
    "first-to-last": eventsForSeed(`${seed}:first-to-last`, settings.rounds["first-to-last"]).map((events) => ({
      game: "first-to-last" as const,
      ids: events.map((event) => event.id),
    })),
  };

  if (settings.order === "grouped") return GAME_SLUGS.flatMap((game) => byGame[game]);

  // One of each game in turn, until every game has run out.
  const turns: Stage[] = [];
  for (let round = 0; turns.length < GAME_SLUGS.reduce((sum, game) => sum + byGame[game].length, 0); round++) {
    for (const game of GAME_SLUGS) {
      const stage = byGame[game][round];
      if (stage) turns.push(stage);
    }
  }
  return settings.order === "shuffle" ? seededShuffle(turns, `${seed}:order`) : turns;
}

const eventsOf = (stage: Stage): HistoryEvent[] =>
  stage.ids.map(eventById).filter((event): event is HistoryEvent => event !== undefined);

/** How a stage stands after `moves`, on the scale every game shares. */
export function stageScore(stage: Stage, moves: unknown[], settings: ExpeditionSettings): Score {
  switch (stage.game) {
    case "who-when-where":
      return whoWhenWhereScore(moves as LifeGuess[]);
    case "wayfarer":
      return wayfarerScore(stage.ids[0], moves as WayfarerGuess[], settings.guesses);
    case "dig-site":
      return digSiteScore(moves as Dig[], settings.digs);
    case "first-to-last":
      return firstToLastScore(eventsOf(stage), moves as Attempt[], settings.attempts);
  }
}

/** What the stage was about, for the results: a name, never a spoiler shown early. */
export function stageAnswer(stage: Stage, locale: Locale): string {
  switch (stage.game) {
    case "who-when-where":
      return personById(stage.ids[0])?.name[locale] ?? "";
    case "wayfarer":
      return journeyById(stage.ids[0])?.name[locale] ?? "";
    case "dig-site": {
      const site = siteById(stage.ids[0]);
      return site ? siteLabel(site, locale) : "";
    }
    case "first-to-last": {
      const years = eventsOf(stage).map((event) => event.year);
      return years.length ? `${formatYear(Math.min(...years), locale)} → ${formatYear(Math.max(...years), locale)}` : "";
    }
  }
}

// The year dials stop at the current year.
const THIS_YEAR = new Date().getFullYear();

type BoardProps = {
  stage: Stage;
  moves: unknown[];
  /** Adds the player's next move. */
  onMove: (move: unknown) => void;
  settings: ExpeditionSettings;
  /** "Stage 3 of 8 — Dig Site" */
  label: string;
  /** Shown with the result once the stage is over. */
  children?: React.ReactNode;
};

/** The game board for one stage. */
export function StageBoard({ stage, moves, onMove, settings, label, children }: BoardProps) {
  switch (stage.game) {
    case "who-when-where": {
      const person = personById(stage.ids[0]);
      return person ? (
        <WhoWhenWhereBoard person={person} guesses={moves as LifeGuess[]} onGuess={onMove} maxYear={THIS_YEAR} label={label}>
          {children}
        </WhoWhenWhereBoard>
      ) : null;
    }
    case "wayfarer": {
      const journey = journeyById(stage.ids[0]);
      return journey ? (
        <WayfarerBoard
          journey={journey}
          guesses={moves as WayfarerGuess[]}
          onGuess={onMove}
          maxGuesses={settings.guesses}
          label={label}
        >
          {children}
        </WayfarerBoard>
      ) : null;
    }
    case "dig-site": {
      const site = siteById(stage.ids[0]);
      return site ? (
        <DigSiteBoard site={site} digs={moves as Dig[]} onDig={onMove} maxDigs={settings.digs} label={label}>
          {children}
        </DigSiteBoard>
      ) : null;
    }
    case "first-to-last":
      return (
        <FirstToLastBoard
          events={eventsOf(stage)}
          attempts={moves as Attempt[]}
          onAttempt={onMove}
          maxAttempts={settings.attempts}
          label={label}
        >
          {children}
        </FirstToLastBoard>
      );
  }
}
