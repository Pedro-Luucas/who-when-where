"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/account/state";
import { BrowserOnly } from "@/components/controls";
import { GAME_SLUGS, GAME_TITLES } from "@/games/slugs";
import { useDayNumber } from "@/lib/clock";
import { formatNumber, numberLocale } from "@/lib/i18n";
import { ActivityGraph } from "./activity-graph";
import { Avatar } from "./avatar";
import { getProfile } from "./client";
import { RelationButton } from "./friends";
import { socialError, useSocialT } from "./messages";
import { useRemote } from "./remote";
import { SocialTabs } from "./tabs";

/** A player's public page, at /player?u=<username>. Without one, the viewer's own. */
export function PlayerProfile() {
  return (
    <BrowserOnly>
      <Profile />
    </BrowserOnly>
  );
}

function Profile() {
  const { locale, t } = useSocialT();
  const account = useAccount();
  const today = useDayNumber();
  const own = account.status === "user" ? account.account.username : null;
  const username = useSearchParams().get("u") ?? own;
  // Keyed by the viewer too: how they stand with the player is part of the answer.
  const viewer = account.status === "user" ? account.account.id : account.status;
  const profile = useRemote(username ? `profile:${username}:${viewer}` : null, () => getProfile(username ?? ""));
  const data = profile.data;

  return (
    <main className="page page-narrow">
      <SocialTabs />
      {!username && account.status !== "loading" && (
        <section className="notice">
          <h1>{t("profile")}</h1>
          <p>{t("profileNone")}</p>
          <div className="page-actions">
            <Link href="/community" className="button">
              {t("community")}
            </Link>
          </div>
        </section>
      )}
      {profile.error && !data && (
        <section className="notice">
          <h1>{t("profile")}</h1>
          <p className="form-error">{t(socialError(profile.error))}</p>
        </section>
      )}
      {username && !data && !profile.error && <div className="page-skeleton skeleton-block" />}

      {data && (
        <>
          <header className="profile-head">
            <Avatar name={data.user.name} color={data.user.avatar} online={data.user.online} size="large" />
            <div>
              <h1>{data.user.name}</h1>
              <p className="eyebrow">
                @{data.user.username} · {data.user.online ? t("online") : t("offline")} ·{" "}
                {t("joined", {
                  date: new Intl.DateTimeFormat(numberLocale(locale), { month: "long", year: "numeric" }).format(
                    data.joinedAt,
                  ),
                })}
              </p>
            </div>
            <div className="profile-actions">
              {data.relation === "self" ? (
                <Link href="/account" className="chip">
                  {t("editProfile")}
                </Link>
              ) : data.relation ? (
                <RelationButton user={data.user} relation={data.relation} onChange={profile.reload} />
              ) : null}
            </div>
          </header>

          <dl className="stat-tiles profile-stats">
            <div>
              <dd>{formatNumber(data.stats.points, locale)}</dd>
              <dt>{t("statPoints")}</dt>
            </div>
            <div>
              <dd>{formatNumber(data.stats.puzzles, locale)}</dd>
              <dt>{t("statPuzzles")}</dt>
            </div>
            <div>
              <dd>{data.stats.days}</dd>
              <dt>{t("statDays")}</dt>
            </div>
            <div>
              <dd>{data.stats.streak}</dd>
              <dt>{t("statStreak")}</dt>
            </div>
            <div>
              <dd>{data.stats.longest}</dd>
              <dt>{t("statLongest")}</dt>
            </div>
            <div>
              <dd>{data.stats.fullDays}</dd>
              <dt>{t("statFullDays")}</dt>
            </div>
          </dl>

          <section className="panel">
            <h2 className="eyebrow">{t("activity")}</h2>
            <ActivityGraph activity={data.activity} today={today} />
          </section>

          <section className="panel">
            <h2 className="eyebrow">{t("byGame")}</h2>
            <table className="game-table">
              <thead>
                <tr>
                  <th scope="col">{t("game")}</th>
                  <th scope="col">{t("statPuzzles")}</th>
                  <th scope="col">{t("statAverage")}</th>
                  <th scope="col">{t("statBest")}</th>
                </tr>
              </thead>
              <tbody>
                {GAME_SLUGS.map((slug) => {
                  const row = data.games.find((entry) => entry.game === slug);
                  return (
                    <tr key={slug}>
                      <th scope="row">{GAME_TITLES[slug]}</th>
                      <td>{row?.played ?? 0}</td>
                      <td>{row ? formatNumber(Math.round(row.points / row.played), locale) : "—"}</td>
                      <td>{row ? formatNumber(row.best, locale) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
