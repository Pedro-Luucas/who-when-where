"use client";

import Link from "next/link";
import { Suspense, use } from "react";
import { browser } from "react-dom";
import { useAccount } from "@/account/state";
import { activityOf, useDailyResults } from "@/games/results";
import { GAME_SLUGS, GAME_TITLES } from "@/games/slugs";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { streaks } from "@/lib/stats";
import { ActivityGraph } from "./activity-graph";
import { useSocialT } from "./messages";

/**
 * The hub's daily challenge: finish all of today's puzzles, keep the streak
 * going, fill the year. Built from the games saved on this device, so it
 * works without an account.
 */
export function DailyPanel() {
  return (
    <Suspense fallback={<section className="daily skeleton-block" aria-busy="true" />}>
      <Panel />
    </Suspense>
  );
}

function Panel() {
  use(browser("The daily challenge is built from the player's local date and saved games."));
  const { locale, t } = useSocialT();
  const today = useDayNumber();
  const results = useDailyResults();
  const account = useAccount();

  const activity = activityOf(results);
  const { streak, longest } = streaks(
    activity.map((entry) => entry.day),
    today,
  );
  const todays = new Map(results.filter((result) => result.day === today).map((result) => [result.game, result]));
  const done = todays.size;
  const points = [...todays.values()].reduce((sum, result) => sum + result.points, 0);
  const complete = done === GAME_SLUGS.length;

  return (
    <section className="daily" aria-labelledby="daily-heading" data-complete={complete ? "" : undefined}>
      <header className="daily-head">
        <div>
          <h2 id="daily-heading" className="eyebrow">
            {t("dailyChallenge")} <span aria-hidden="true">—</span> {t("dayNo", { n: today })}
          </h2>
          <p className="daily-title">
            {complete ? t("dailyComplete") : done ? t("dailyProgress", { n: GAME_SLUGS.length - done }) : t("dailyStart")}
          </p>
        </div>
        <dl className="daily-stats">
          <div>
            <dd>
              {done}/{GAME_SLUGS.length}
            </dd>
            <dt>{t("statToday")}</dt>
          </div>
          <div>
            <dd>{formatNumber(points, locale)}</dd>
            <dt>{t("statPointsOf", { max: formatNumber(GAME_SLUGS.length * MAX_POINTS, locale) })}</dt>
          </div>
          <div data-lit={streak > 0 ? "" : undefined}>
            <dd>{streak}</dd>
            <dt>{t("statStreak")}</dt>
          </div>
          <div>
            <dd>{longest}</dd>
            <dt>{t("statLongest")}</dt>
          </div>
        </dl>
      </header>

      <ul className="daily-games">
        {GAME_SLUGS.map((game) => {
          const result = todays.get(game);
          return (
            <li key={game}>
              <Link href={`/${game}`} data-done={result ? "" : undefined}>
                <i aria-hidden="true">{result ? "✓" : ""}</i>
                <b>{GAME_TITLES[game]}</b>
                <span>{result ? formatNumber(result.points, locale) : `${t("play")} →`}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <ActivityGraph activity={activity} today={today} />

      <p className="hint daily-note">
        {account.status === "guest" ? (
          <>
            {t("dailyGuest")} <Link href="/account">{t("joinAction")}</Link>
          </>
        ) : (
          <>
            {t("dailyMember")} <Link href="/leaderboard">{t("leaderboard")} →</Link>
          </>
        )}
      </p>
    </section>
  );
}
