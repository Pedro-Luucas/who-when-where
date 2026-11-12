"use client";

import Link from "next/link";
import { useAccount } from "@/account/state";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { CHALLENGE_GAMES } from "@/games/registry";
import { useDailyResults } from "@/games/results";
import { useToday } from "@/games/today";
import { formatNumber, numberLocale, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { Countdown, DailyCards, DoneRing } from "./dailies";

/** The head of /daily: the title, today's date and countdown, the cards, and the day's progress beside them. */
export function DailyBoard() {
  const t = useShellT();
  const locale = useLocale();
  const { day, done, of } = useToday();
  const account = useAccount();
  const points = useDailyResults()
    .filter((result) => result.day === day)
    .reduce((sum, result) => sum + result.points, 0);
  // The first of today's puzzles still waiting.
  const next = CHALLENGE_GAMES.find((game) => of(game.slug).state !== "done");

  return (
    <section className="daily-board" aria-labelledby="daily-board-heading">
      <header className="section-head">
        <div className="section-title">
          <h1 id="daily-board-heading">{t("dailyGames")}</h1>
        </div>
        <p className="section-lead">
          {day > 0 && (
            <time className="daily-date">
              {new Intl.DateTimeFormat(numberLocale(locale), { day: "numeric", month: "long", year: "numeric" }).format(new Date())}
            </time>
          )}
          <Countdown />
        </p>
      </header>

      <div className="daily-board-grid">
        <DailyCards variant="grid" />
        <aside className="daily-aside">
          <div className="panel-card daily-progress">
            <h2 className="eyebrow">{t("dailyProgress")}</h2>
            <DoneRing size={112} />
            <p className="daily-points">{t("pointsToday", { n: formatNumber(points, locale) })}</p>
            {done === CHALLENGE_GAMES.length ? (
              <p className="hint">{t("dailyAllDone")}</p>
            ) : (
              next && (
                <ButtonLink href={`/play/${next.slug}`} variant="play" wide icon={<Icon name="play" size={16} />}>
                  {t("playNow")}
                </ButtonLink>
              )
            )}
          </div>
          {account.status === "guest" && (
            <div className="panel-card perks">
              <h2 className="eyebrow">{t("perksTitle")}</h2>
              <ul>
                <li>
                  <Icon name="flag" /> {t("perkStreak")}
                </li>
                <li>
                  <Icon name="trophy" /> {t("perkBoard")}
                </li>
                <li>
                  <Icon name="people" /> {t("perkFriends")}
                </li>
              </ul>
              <ButtonLink href="/account?mode=signup" wide icon={<Icon name="user" size={16} />}>
                {t("createAccount")}
              </ButtonLink>
              <p className="hint">{t("guestStrip")}</p>
            </div>
          )}
          {account.status === "user" && (
            <div className="panel-card perks">
              <Link href="/leaderboard" className="key key-secondary w-full">
                <Icon name="trophy" size={16} /> {t("navLeaderboard")}
              </Link>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
