"use client";

import { Suspense, use } from "react";
import { browser } from "react-dom";
import { movesOf, useGameSave } from "@/games/platform/store";
import { gameBySlug, type GameSlug } from "@/games/registry";
import { useDailyResults } from "@/games/results";
import { useDayNumber } from "@/lib/clock";
import { formatNumber, useLocale, useSiteT } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";

/**
 * A game's line on its hub card: today's puzzle number and how the player
 * stands — its result once finished ("750/1,000", "3/6"), else whether it was
 * started. Read from the save and the scored results, so no game is loaded.
 */
export function GameStatus({ game }: { game: GameSlug }) {
  return (
    <Suspense fallback={<span>&nbsp;</span>}>
      <Status game={game} />
    </Suspense>
  );
}

function Status({ game }: { game: GameSlug }) {
  use(browser("Today's progress depends on the player's local date and saved games."));
  const definition = gameBySlug(game);
  const day = useDayNumber();
  const t = useSiteT();
  const locale = useLocale();
  const [save] = useGameSave<unknown>(definition);
  const result = useDailyResults().find((entry) => entry.game === game && entry.day === day);

  if (result) {
    const text =
      definition.status === "points"
        ? `${formatNumber(result.points, locale)}/${formatNumber(MAX_POINTS, locale)}`
        : result.detail;
    return (
      <>
        <span>
          #{day} · {text}
        </span>
        <strong>{t("seeResult")} →</strong>
      </>
    );
  }
  const started = movesOf(definition, save.days[day]).length > 0;
  return (
    <>
      <span>
        #{day} · {t(started ? "inProgress" : "notPlayed")}
      </span>
      <strong>{t(started ? "continue" : "play")} →</strong>
    </>
  );
}
