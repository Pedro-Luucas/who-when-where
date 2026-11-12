"use client";

import Link from "next/link";
import { Suspense, use } from "react";
import { browser } from "react-dom";
import { useAccount } from "@/account/state";
import { activityOf, useDailyResults } from "@/games/results";
import { inChallenge } from "@/games/registry";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { levelOf } from "@/logbook/level";
import { useLogbookT, type LogbookKey } from "@/logbook/messages";
import { ActivityGraph } from "./activity-graph";
import { useSocialT } from "./messages";

/**
 * The daily page's year of play: the level the points have earned, and one
 * square per day, shaded by how many of the dailies were finished. Built from
 * the games saved on this device, so it works without an account.
 */
export function DailyYear() {
  return (
    <Suspense fallback={<section className="daily skeleton-block" aria-busy="true" />}>
      <Year />
    </Suspense>
  );
}

function Year() {
  use(browser("The year of play is built from the day by the clock and the saved games."));
  const { locale, t } = useSocialT();
  const shell = useShellT();
  const { t: logbookT } = useLogbookT();
  const today = useDayNumber();
  const results = useDailyResults();
  const account = useAccount();

  // The graph shades a day by its dailies; the level counts every puzzle's points.
  const activity = activityOf(results.filter((result) => inChallenge(result.game)));
  const { level, into, step, rank } = levelOf(results.reduce((sum, result) => sum + result.points, 0));

  return (
    <section className="daily" aria-labelledby="daily-year-heading">
      <header className="daily-head">
        <h2 id="daily-year-heading" className="eyebrow">
          {shell("yourYear")}
        </h2>
      </header>

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
      </div>

      <ActivityGraph activity={activity} today={today} />

      <p className="hint daily-note">
        {account.status === "guest" ? (
          <>
            {t("dailyGuest")} <Link href="/account?next=/daily">{t("joinAction")}</Link>
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
