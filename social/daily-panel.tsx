"use client";

import Link from "next/link";
import { Suspense, use } from "react";
import { browser } from "react-dom";
import { useAccount } from "@/account/state";
import { ShareButton } from "@/components/share-button";
import { gradeOf } from "@/expedition/run";
import { activityOf, useDailyResults, type DailyResult } from "@/games/results";
import { GAME_SLUGS, GAME_TITLES, type GameSlug } from "@/games/registry";
import { useDayNumber } from "@/lib/clock";
import { formatNumber, type Locale } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { streaks } from "@/lib/stats";
import { levelOf } from "@/logbook/level";
import { useLogbookT, type LogbookKey } from "@/logbook/messages";
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

// One square per game, from a puzzle not played to one that went very well.
const UNPLAYED = "⬜";
const SQUARES = ["⬛", "🟥", "🟧", "🟨", "🟩"];

/** The whole day in a few lines, to paste into a chat: no puzzle is given away. */
function dayShareText(
  day: number,
  todays: Map<GameSlug, DailyResult>,
  streak: number,
  locale: Locale,
  url: string,
): string {
  const points = [...todays.values()].reduce((sum, result) => sum + result.points, 0);
  const trail = GAME_SLUGS.map((game) => {
    const result = todays.get(game);
    return result ? SQUARES[gradeOf(result.points)] : UNPLAYED;
  }).join("");
  const total = `${formatNumber(points, locale)}/${formatNumber(GAME_SLUGS.length * MAX_POINTS, locale)}`;
  return [
    `Who When Where #${day} · ${total}`,
    streak > 1 ? `${trail} 🔥${streak}` : trail,
    url,
  ].join("\n");
}

function Panel() {
  use(browser("The daily challenge is built from the player's local date and saved games."));
  const { locale, t } = useSocialT();
  const { t: logbookT } = useLogbookT();
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
  const { level, into, step, rank } = levelOf(results.reduce((sum, result) => sum + result.points, 0));

  return (
    <section className="daily" aria-labelledby="daily-heading" data-complete={complete ? "" : undefined}>
      <header className="daily-head">
        <div>
          <h2 id="daily-heading" className="eyebrow">
            {t("dailyChallenge")} <span aria-hidden="true">—</span> {t("dayNo", { n: today })}
          </h2>
          <p className="daily-title">
            {complete
              ? t("dailyComplete", { n: GAME_SLUGS.length })
              : done
                ? t("dailyProgress", { n: GAME_SLUGS.length - done })
                : t("dailyStart", { n: GAME_SLUGS.length })}
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
              <Link href={`/play/${game}`} data-done={result ? "" : undefined}>
                <i aria-hidden="true">{result ? "✓" : ""}</i>
                <b>{GAME_TITLES[game]}</b>
                <span>{result ? formatNumber(result.points, locale) : `${t("play")} →`}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="daily-level">
        <Link href="/logbook" className="daily-rank">
          <i className="seal" aria-hidden="true">
            {level}
          </i>
          <span>
            <b>{logbookT(`rank${rank}` as LogbookKey)}</b>
            <small>
              {logbookT("level", { n: level })} · {logbookT("toNext", { n: formatNumber(step - into, locale), next: level + 1 })}
            </small>
            <span className="bar" aria-hidden="true">
              <i style={{ width: `${(into / step) * 100}%` }} />
            </span>
          </span>
          <strong>{logbookT("logbook")} →</strong>
        </Link>
        {done > 0 && (
          <ShareButton
            className="chip"
            label={t("shareDay")}
            text={() => dayShareText(today, todays, streak, locale, window.location.origin)}
          />
        )}
      </div>

      <ActivityGraph activity={activity} today={today} />

      <p className="hint daily-note">
        {account.status === "guest" ? (
          <>
            {t("dailyGuest")} <Link href="/account?next=/">{t("joinAction")}</Link>
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
