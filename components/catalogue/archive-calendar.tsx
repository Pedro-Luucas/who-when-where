"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { ARCHIVE_DAYS } from "@/games/daily-set";
import { CHALLENGE_GAMES } from "@/games/registry";
import { useDailyResults } from "@/games/results";
import { useDailyRecord } from "@/games/today";
import { dateOfDay } from "@/lib/daily";
import { formatNumber, numberLocale, useLocale } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { useShellT, type ShellKey } from "@/lib/shell-messages";

type CellState = "full" | "part" | "frozen" | "missed" | "today" | "future" | "locked" | "before";

const LABEL: Record<CellState, ShellKey> = {
  full: "calFull",
  part: "calPart",
  frozen: "calFrozen",
  missed: "calMissed",
  today: "calToday",
  future: "calFuture",
  locked: "calLocked",
  before: "calBefore",
};

// 1 Nov 2027 is a Monday: the weekday names, Monday first.
const MONDAY = Date.UTC(2027, 10, 1);

/**
 * The archive: a calendar of the last weeks, each day marked by how many of
 * its dailies were finished (or that a freeze saved it). Picking a day lists
 * its puzzles: the ones finished on the day show their score, the others can
 * be played from the archive (/play/<game>?day=N), for fun only.
 */
export function ArchiveCalendar() {
  const t = useShellT();
  const locale = useLocale();
  const { day: today, days, streak } = useDailyRecord();
  const results = useDailyResults();
  const [picked, setPicked] = useState<number | null>(null);

  const total = CHALLENGE_GAMES.length;
  const oldest = Math.max(1, today - ARCHIVE_DAYS);
  const frozen = new Set(streak.frozen);
  const dates = numberLocale(locale);
  const weekday = new Intl.DateTimeFormat(dates, { weekday: "narrow", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(dates, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const month = new Intl.DateTimeFormat(dates, { month: "short", timeZone: "UTC" });

  // Whole weeks, Monday to Sunday, from the oldest day on offer to the week of today.
  const mondayOf = (day: number) => day - ((dateOfDay(day).getUTCDay() + 6) % 7);
  const first = mondayOf(oldest);
  const last = mondayOf(today) + 6;
  const cells = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  const stateOf = (day: number): CellState => {
    if (day < 1) return "before";
    if (day > today) return "future";
    const entry = days.get(day);
    if (entry && entry.done >= total) return "full";
    if (day === today) return "today";
    if (day < oldest) return "locked";
    if (entry) return "part";
    return frozen.has(day) ? "frozen" : "missed";
  };
  const selectable = (day: number) => day >= oldest && day <= today;
  const shown = picked !== null && selectable(picked) ? picked : today > 1 ? today - 1 : today;

  // On the server, and for the moment before the clock is read, there is no day to draw.
  if (!today) return <section className="panel-card archive skeleton-block" id="archive" aria-busy="true" />;

  const pickedResults = new Map(results.filter((result) => result.day === shown).map((result) => [result.game, result.points]));

  return (
    <section className="panel-card archive" id="archive" aria-labelledby="archive-heading">
      <h2 id="archive-heading" className="archive-title">
        {t("archiveTitle")}
      </h2>
      <div className="archive-grid" role="group" aria-labelledby="archive-heading">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={`w${i}`} className="archive-weekday" aria-hidden="true">
            {weekday.format(MONDAY + i * 86_400_000)}
          </span>
        ))}
        {cells.map((day) => {
          const state = stateOf(day);
          const date = dateOfDay(day);
          const entry = days.get(day);
          // The first cell, and the 1st of a month, carry the month's name.
          const label = day === first || date.getUTCDate() === 1 ? month.format(date) : null;
          const what = t(LABEL[state], { n: entry?.done ?? 0, total });
          const content = (
            <>
              {label && <small>{label}</small>}
              {date.getUTCDate()}
            </>
          );
          return selectable(day) ? (
            <button
              key={day}
              type="button"
              className="archive-day"
              data-state={state}
              data-today={day === today ? "" : undefined}
              aria-pressed={day === shown}
              aria-label={`${longDate.format(date)}: ${what}`}
              onClick={() => setPicked(day)}
            >
              {content}
            </button>
          ) : (
            <span key={day} className="archive-day" data-state={state} title={`${longDate.format(date)}: ${what}`}>
              {content}
            </span>
          );
        })}
      </div>
      <p className="archive-legend" aria-hidden="true">
        <span data-state="full">{t("calLegendFull")}</span>
        <span data-state="part">{t("calLegendPart")}</span>
        <span data-state="frozen">{t("calLegendFrozen")}</span>
      </p>

      <div className="archive-picked" aria-live="polite">
        <h3 className="eyebrow">
          {shown === today
            ? `${t("archiveToday")} · #${shown}`
            : t("archiveDay", { date: longDate.format(dateOfDay(shown)), n: shown })}
        </h3>
        <ul>
          {CHALLENGE_GAMES.map((game) => {
            const points = pickedResults.get(game.slug);
            const href = shown === today ? `/play/${game.slug}` : `/play/${game.slug}?day=${shown}`;
            return (
              <li key={game.slug} style={{ "--fam": `var(--color-family-${game.family})` } as React.CSSProperties}>
                <Link href={href}>
                  <span className="archive-game">{game.title}</span>
                  {points !== undefined ? (
                    <Chip tone="success" icon={<span aria-hidden="true">✓</span>}>
                      {formatNumber(points, locale)}/{formatNumber(MAX_POINTS, locale)}
                    </Chip>
                  ) : (
                    <span className="archive-go">{t("archivePlay")} →</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="hint">{t("archiveLead", { n: ARCHIVE_DAYS })}</p>
    </section>
  );
}
