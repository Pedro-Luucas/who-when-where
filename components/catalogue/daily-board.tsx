"use client";

import { DailyYear } from "@/social/daily-panel";
import { useDayNumber } from "@/lib/clock";
import { dateOfDay } from "@/lib/daily";
import { numberLocale, useLocale } from "@/lib/i18n";
import { CHALLENGE_GAMES } from "@/games/registry";
import { useShellT } from "@/lib/shell-messages";
import { ArchiveCalendar } from "./archive-calendar";
import { Countdown, DailyCards } from "./dailies";
import { StreakDial } from "./streak-dial";

/**
 * /daily, after geocore's dailies page: the title with today's date and the
 * countdown to the next puzzles, the five daily cards, and beside them the
 * streak dial and the archive calendar; the year of play below.
 */
export function DailyBoard() {
  const t = useShellT();
  const locale = useLocale();
  const day = useDayNumber();

  return (
    <section className="daily-board" aria-labelledby="daily-board-heading">
      <header className="daily-board-head">
        <h1 id="daily-board-heading">{t("dailyGames")}</h1>
        <p className="section-lead">
          {day > 0 && (
            <time className="daily-date" dateTime={dateOfDay(day).toISOString().slice(0, 10)}>
              {new Intl.DateTimeFormat(numberLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
                dateOfDay(day),
              )}
            </time>
          )}
          <Countdown />
        </p>
        <p className="daily-board-lead">{t("dailySetLead", { n: CHALLENGE_GAMES.length })}</p>
      </header>

      <div className="daily-board-grid">
        <div className="daily-main">
          <DailyCards variant="grid" />
          <DailyYear />
        </div>
        <aside className="daily-aside">
          <StreakDial />
          <ArchiveCalendar />
        </aside>
      </div>
    </section>
  );
}
