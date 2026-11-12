"use client";

import Link from "next/link";
import { useAccount } from "@/account/state";
import { DoneRing } from "@/components/catalogue/dailies";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CHALLENGE_GAMES } from "@/games/registry";
import { streakDays, useDailyResults } from "@/games/results";
import { useToday } from "@/games/today";
import { formatNumber, useLocale, useSiteT } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { streaks } from "@/lib/stats";
import { levelOf } from "@/logbook/level";

/**
 * The top of the home page. Guests get the landing: what the site is and the
 * ways in. Signed-in players get their dashboard: today's progress, streak,
 * level, and the next puzzle waiting.
 */
export function HomeHero() {
  const t = useShellT();
  const site = useSiteT();
  const locale = useLocale();
  const account = useAccount();
  const { day, done, of } = useToday();
  const results = useDailyResults();
  const user = account.status === "user" ? account.account : null;

  const { streak } = streaks(streakDays(results), day);
  const { level } = levelOf(results.reduce((sum, result) => sum + result.points, 0));
  const pointsToday = results.filter((result) => result.day === day).reduce((sum, result) => sum + result.points, 0);
  const next = CHALLENGE_GAMES.find((game) => of(game.slug).state !== "done");

  return (
    <section className="home-hero" aria-labelledby="home-heading">
      <div className="home-hero-text">
        {user ? (
          <>
            <p className="eyebrow home-kicker">{t("heroKicker")}</p>
            <h1 id="home-heading" className="home-welcome">
              {t("welcomeBack", { name: user.displayName || user.username || "" })}
            </h1>
            <p className="home-lead">{t("dashboardLead")}</p>
            <p className="home-chips">
              <Chip tone="pro" icon={<span aria-hidden="true">🔥</span>}>
                {t("streakDays", { n: streak })}
              </Chip>
              <Chip tone="accent">Lv {level}</Chip>
              <Chip tone="success">{t("pointsToday", { n: formatNumber(pointsToday, locale) })}</Chip>
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow home-kicker">{t("heroKicker")}</p>
            <h1 id="home-heading" className="home-title">
              Who <span>When</span> Where
            </h1>
            <p className="home-tagline">{t("heroTagline")}</p>
            <p className="home-lead">{t("heroLead")}</p>
          </>
        )}
        <div className="home-actions">
          {/* Started today: carry on with the next daily. All done: the day to look back on and share. */}
          <ButtonLink
            href={!next ? "/daily" : user || done > 0 ? `/play/${next.slug}` : "/play"}
            variant="play"
            size="lg"
            icon={<Icon name={next ? "play" : "calendar"} size={18} />}
          >
            {!next ? site("dayDoneCta") : user || done > 0 ? t("continue") : t("playNow")}
          </ButtonLink>
          <ButtonLink href="/party" size="lg" icon={<Icon name="party" size={18} />}>
            {t("playWithFriends")}
          </ButtonLink>
          {account.status === "guest" && (
            <ButtonLink href="/account?mode=signup" variant="secondary" size="lg" icon={<Icon name="user" size={18} />}>
              {t("createAccount")}
            </ButtonLink>
          )}
        </div>
      </div>

      <aside className="today-card" aria-labelledby="today-card-heading">
        <header>
          <h2 id="today-card-heading">{t("todayOn")}</h2>
          {day > 0 && <span className="eyebrow">#{day}</span>}
        </header>
        <div className="today-card-body">
          <DoneRing size={72} />
          <ul>
            {CHALLENGE_GAMES.map((game) => {
              const state = of(game.slug).state;
              return (
                <li key={game.slug} data-state={state} style={{ "--fam": `var(--color-family-${game.family})` } as React.CSSProperties}>
                  <Link href={`/play/${game.slug}`}>
                    <i aria-hidden="true">{state === "done" ? "✓" : ""}</i>
                    <span>{game.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <Link href="/daily" className="key key-secondary key-sm w-full">
          {t("allDailies")}
          <Icon name="chevron" size={15} />
        </Link>
        <span className="sr-only">{t("doneOf", { n: done, total: CHALLENGE_GAMES.length })}</span>
      </aside>
    </section>
  );
}
