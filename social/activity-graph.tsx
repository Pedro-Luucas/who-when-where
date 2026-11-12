"use client";

import { CHALLENGE_SLUGS } from "@/games/registry";
import { dateOfDay } from "@/lib/daily";
import { formatNumber, numberLocale } from "@/lib/i18n";
import { useSocialT } from "./messages";

/** What was played on one day. */
export type DayActivity = { day: number; puzzles: number; points: number };

type Props = {
  activity: DayActivity[];
  /** The puzzle number of the viewer's today: the graph's last square. */
  today: number;
};

/** A year, like the graph it borrows from. Narrow screens show the latest weeks. */
const WEEKS = 53;
const ROWS = [0, 1, 2, 3, 4, 5, 6];

/**
 * A year of daily play, one square per day and one column per week: the more
 * of the day's puzzles were finished, the darker the square.
 */
export function ActivityGraph({ activity, today }: Props) {
  const { locale, t } = useSocialT();
  const byDay = new Map(activity.map((entry) => [entry.day, entry]));
  const dates = numberLocale(locale);
  const dayName = new Intl.DateTimeFormat(dates, { dateStyle: "medium", timeZone: "UTC" });
  const monthName = new Intl.DateTimeFormat(dates, { month: "short", timeZone: "UTC" });
  const weekdayName = new Intl.DateTimeFormat(dates, { weekday: "short", timeZone: "UTC" });

  // Columns run Sunday to Saturday; the last one holds today.
  const firstDay = today - dateOfDay(today).getUTCDay() - 7 * (WEEKS - 1);
  const weeks = Array.from({ length: WEEKS }, (_, week) => firstDay + week * 7);
  const played = activity.filter((entry) => entry.day >= firstDay && entry.day <= today);

  return (
    <figure
      className="activity"
      role="img"
      aria-label={t("activityAria", {
        days: played.length,
        puzzles: played.reduce((sum, entry) => sum + entry.puzzles, 0),
      })}
    >
      <div className="activity-scroll">
        <div className="activity-days" aria-hidden="true">
          {ROWS.map((row) => (
            // 2 Nov 2025 was a Sunday.
            <span key={row}>{row % 2 ? weekdayName.format(Date.UTC(2025, 10, 2 + row)) : ""}</span>
          ))}
        </div>
        <div className="activity-weeks" aria-hidden="true">
          {weeks.map((start, week) => {
            const month = dateOfDay(start + 6).getUTCMonth();
            const newMonth = week === 0 || month !== dateOfDay(start - 1).getUTCMonth();
            return (
              <div key={start} className="activity-week">
                <span className="activity-month">{newMonth ? monthName.format(dateOfDay(start + 6)) : ""}</span>
                {ROWS.map((row) => {
                  const day = start + row;
                  if (day > today) return <i key={row} data-level="none" />;
                  const date = dayName.format(dateOfDay(day));
                  // Before the first puzzle there was nothing to play.
                  if (day < 1) return <i key={row} data-level="before" title={date} />;
                  const entry = byDay.get(day);
                  // Four shades: the last one is a day with every puzzle finished.
                  const level = Math.ceil((Math.min(entry?.puzzles ?? 0, CHALLENGE_SLUGS.length) / CHALLENGE_SLUGS.length) * 4);
                  const title = entry
                    ? t("activityDay", {
                        date,
                        puzzles: entry.puzzles,
                        total: CHALLENGE_SLUGS.length,
                        points: formatNumber(entry.points, locale),
                      })
                    : t("activityNone", { date });
                  return <i key={row} data-level={level} data-today={day === today ? "" : undefined} title={title} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="activity-legend">
        <span>{t("activityLess")}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} data-level={level} />
        ))}
        <span>{t("activityMore")}</span>
      </figcaption>
    </figure>
  );
}
