"use client";

import { useAccount } from "@/account/state";
import { Icon } from "@/components/shell/nav-items";
import { ShareButton } from "@/components/share-button";
import { ButtonLink } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { gradeOf } from "@/expedition/run";
import { CHALLENGE_GAMES } from "@/games/registry";
import { useDailyResults } from "@/games/results";
import { useDailyRecord, useToday } from "@/games/today";
import { dateOfDay } from "@/lib/daily";
import { formatNumber, numberLocale, useLocale } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { recapQuery, type Recap } from "@/lib/recap";
import { useShellT } from "@/lib/shell-messages";
import { STREAK_RULES } from "@/lib/streak";
import { useNextDayTime } from "./dailies";

// One square per daily, from a puzzle not played to one that went very well.
const UNPLAYED = "⬜";
const SQUARES = ["⬛", "🟥", "🟧", "🟨", "🟩"];

/**
 * The daily page's dial: how many of today's dailies are done, the streak
 * and its freezes, the records, and the way on — the next daily to play, or
 * the day to share once it has begun.
 */
export function StreakDial() {
  const t = useShellT();
  const locale = useLocale();
  const account = useAccount();
  const { day, done, of } = useToday();
  const { streak, perfect } = useDailyRecord();
  const results = useDailyResults();
  const at = useNextDayTime();

  const total = CHALLENGE_GAMES.length;
  const todays = new Map(results.filter((result) => result.day === day).map((result) => [result.game, result.points]));
  const points = CHALLENGE_GAMES.reduce((sum, game) => sum + (todays.get(game.slug) ?? 0), 0);
  const next = CHALLENGE_GAMES.find((game) => of(game.slug).state !== "done");
  const lastFrozen = streak.frozen.at(-1);

  const recap: Recap = {
    day,
    scores: CHALLENGE_GAMES.map((game) => ({ game: game.slug, points: todays.get(game.slug) ?? null })),
    streak: streak.streak,
    locale,
  };
  const shareText = () => {
    const trail = CHALLENGE_GAMES.map((game) => {
      const got = todays.get(game.slug);
      return got === undefined ? UNPLAYED : SQUARES[gradeOf(got)];
    }).join("");
    return [
      `Who When Where #${day} · ${formatNumber(points, locale)}/${formatNumber(total * MAX_POINTS, locale)}`,
      streak.streak > 1 ? `${trail} 🔥${streak.streak}` : trail,
      `${window.location.origin}/daily/recap?${recapQuery(recap)}`,
    ].join("\n");
  };

  const status = streak.playedToday ? t("streakSafe") : streak.streak > 0 ? t("streakAtRisk", { at }) : t("streakStart");

  return (
    <section className="panel-card streak-dial" aria-labelledby="streak-dial-heading">
      <h2 id="streak-dial-heading" className="sr-only">
        {t("streakTitle")}
      </h2>
      <div className="streak-dial-ring">
        <ProgressRing
          value={done / total}
          size={168}
          stroke={12}
          color="var(--play)"
          label={`${t("doneOf", { n: done, total })} ${t("doneTodayLabel")}`}
        >
          <span className="streak-dial-count">
            <b>{t("doneOf", { n: done, total })}</b>
            <small>{t("doneTodayLabel")}</small>
          </span>
        </ProgressRing>
      </div>

      <div className="streak-flame" data-lit={streak.streak > 0 ? "" : undefined} data-safe={streak.playedToday ? "" : undefined}>
        <span className="streak-flame-icon" aria-hidden="true">
          🔥
        </span>
        <span className="streak-flame-number">{formatNumber(streak.streak, locale)}</span>
        <span className="streak-flame-label">{t("streakDayLabel")}</span>
      </div>
      <p className="streak-status" data-risk={!streak.playedToday && streak.streak > 0 ? "" : undefined}>
        {status}
      </p>

      <div className="streak-freezes" title={t("freezeHelp", { max: STREAK_RULES.maxFreezes })}>
        <span className="eyebrow">{t("freezes")}</span>
        <span className="streak-freeze-pips" aria-hidden="true">
          {Array.from({ length: STREAK_RULES.maxFreezes }, (_, i) => (
            <i key={i} data-held={i < streak.freezes ? "" : undefined}>
              ❄
            </i>
          ))}
        </span>
        <span className="streak-freeze-count">{t("freezeCount", { n: streak.freezes, max: STREAK_RULES.maxFreezes })}</span>
        <p className="hint">
          {t("freezeHelp", { max: STREAK_RULES.maxFreezes })}
          {lastFrozen !== undefined && (
            <>
              {" "}
              {t("freezeUsed", {
                date: new Intl.DateTimeFormat(numberLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(
                  dateOfDay(lastFrozen),
                ),
              })}
            </>
          )}
        </p>
      </div>

      <dl className="streak-stats">
        <div>
          <dt>{t("statLongestStreak")}</dt>
          <dd>{formatNumber(streak.longest, locale)}</dd>
        </div>
        <div>
          <dt>{t("statPerfectDays")}</dt>
          <dd>{formatNumber(perfect.days, locale)}</dd>
        </div>
        <div>
          <dt>{t("statToday")}</dt>
          <dd>
            {formatNumber(points, locale)}
            <small>/{formatNumber(total * MAX_POINTS, locale)}</small>
          </dd>
        </div>
      </dl>

      {next ? (
        <ButtonLink href={`/play/${next.slug}`} variant="play" wide icon={<Icon name="play" size={16} />}>
          {t("playGame", { game: next.title })}
        </ButtonLink>
      ) : (
        <p className="hint streak-done">{t("dailyAllDone")}</p>
      )}
      {done > 0 && (
        <div className="streak-share">
          <ShareButton className="key key-secondary key-sm" label={t("shareDay")} text={shareText} />
          <a className="key key-ghost key-sm" href={`/daily/card?${recapQuery(recap)}`} download={`who-when-where-${day}.png`}>
            {t("downloadCard")}
          </a>
        </div>
      )}

      {account.status === "guest" && (
        <div className="streak-guest">
          <p className="hint">{t("guestStreakNote")}</p>
          <ButtonLink href="/account?mode=signup" wide icon={<Icon name="user" size={16} />}>
            {t("createAccount")}
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
