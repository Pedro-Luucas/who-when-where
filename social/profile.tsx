"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccount } from "@/account/state";
import { BrowserOnly } from "@/components/controls";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { FamilyIcon } from "@/components/ui/family-icon";
import { StatTile } from "@/components/ui/stat-tile";
import { GAME_TITLES, gameBySlug, isGameSlug } from "@/games/registry";
import { useDayNumber } from "@/lib/clock";
import { formatNumber, numberLocale } from "@/lib/i18n";
import { ActivityGraph } from "./activity-graph";
import { Avatar, Flag } from "./avatar";
import { getProfile, type Profile as ProfileData } from "./client";
import { tierKey, useConnectT } from "./connect-messages";
import { RelationButton } from "./friends";
import { socialError, useSocialT } from "./messages";
import { useRemote } from "./remote";
import { ShareKey } from "./share-key";
import { SocialTabs } from "./tabs";
import { TierBadge } from "./tier-badge";

/**
 * A player's public page, at /u/<username> (and the older /player?u=…).
 * Without a name, the viewer's own.
 */
export function PlayerProfile({ username }: { username?: string }) {
  return (
    <BrowserOnly>
      <Profile name={username} />
    </BrowserOnly>
  );
}

function Profile({ name }: { name?: string }) {
  const { t: ts } = useSocialT();
  const { t } = useConnectT();
  const account = useAccount();
  const own = account.status === "user" ? account.account.username : null;
  const fromQuery = useSearchParams().get("u");
  const username = (name ?? fromQuery ?? own)?.toLowerCase() ?? null;
  // Keyed by the viewer too: how they stand with the player is part of the answer.
  const viewer = account.status === "user" ? account.account.id : account.status;
  const profile = useRemote(username ? `profile:${username}:${viewer}` : null, () => getProfile(username ?? ""));
  const data = profile.data;
  const notFound = profile.error?.code === "no_such_player";

  return (
    <main className="page">
      <SocialTabs />
      {!username && account.status !== "loading" && (
        <EmptyState
          icon={<Icon name="user" />}
          title={ts("profile")}
          action={
            <ButtonLink href="/account" variant="primary">
              {t("signInOrUp")}
            </ButtonLink>
          }
        >
          {ts("profileNone")}
        </EmptyState>
      )}
      {notFound && (
        <EmptyState
          icon={<Icon name="search" />}
          title={t("profileNotFoundTitle")}
          action={
            <ButtonLink href="/community" variant="secondary">
              {t("findPlayers")}
            </ButtonLink>
          }
        >
          {t("profileNotFoundLead")}
        </EmptyState>
      )}
      {profile.error && !data && !notFound && (
        <EmptyState icon={<Icon name="close" />} title={ts("profile")}>
          {ts(socialError(profile.error))}
        </EmptyState>
      )}
      {username && !data && !profile.error && <div className="page-skeleton skeleton-block" aria-busy="true" />}

      {data && <ProfileView data={data} reload={profile.reload} />}
    </main>
  );
}

function ProfileView({ data, reload }: { data: ProfileData; reload: () => void }) {
  const { locale, t: ts } = useSocialT();
  const { t } = useConnectT();
  const today = useDayNumber();
  const self = data.relation === "self";
  const friends = data.relation === "friends";
  const profileUrl = () => `${window.location.origin}/u/${data.user.username}`;
  const since = new Intl.DateTimeFormat(numberLocale(locale), { month: "long", year: "numeric" }).format(data.joinedAt);
  const played = (data.games ?? [])
    .filter((entry) => isGameSlug(entry.game) && entry.played > 0)
    .sort((a, b) => b.played - a.played || b.best - a.best);

  return (
    <>
      <Card as="section" className="profile-hero mb-5 !p-0" aria-labelledby="profile-name">
        <div className="profile-hero-band" aria-hidden="true" />
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
          <Avatar
            name={data.user.name}
            color={data.user.avatar}
            online={data.private ? undefined : data.user.online}
            presenceLabels={{ online: ts("online"), away: ts("offline") }}
            size="large"
            className="profile-hero-avatar"
          />
          <div className="min-w-0 flex-1">
            <h1 id="profile-name" className="flex flex-wrap items-center gap-2 font-display text-3xl font-bold text-fg">
              {data.user.name} <Flag code={data.user.country} className="h-[18px] w-[25px] rounded-[3px] object-cover" />
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-fg-2">
              <span>@{data.user.username}</span>
              {!data.private && (
                <span className="inline-flex items-center gap-1.5">
                  <i
                    aria-hidden="true"
                    className={data.user.online ? "size-2 rounded-full bg-answer shadow-[0_0_8px_var(--answer)]" : "size-2 rounded-full bg-fg-3"}
                  />
                  {data.user.online ? ts("online") : ts("offline")}
                </span>
              )}
              <span>{t("memberSince", { date: since })}</span>
            </p>
            {!data.private && (data.leagueTier ?? null) !== null && (
              <p className="mt-2 flex flex-wrap gap-2">
                <TierBadge tier={data.leagueTier ?? 0} label={t("tierBadge", { tier: t(tierKey(data.leagueTier ?? 0)) })} />
                {(data.stats?.streak ?? 0) > 0 && <Chip tone="pro">🔥 {data.stats.streak}</Chip>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("profileActions")}>
            {self ? (
              <ButtonLink href="/account" variant="secondary" size="sm" icon={<Icon name="sliders" />}>
                {t("editProfile")}
              </ButtonLink>
            ) : data.relation ? (
              <RelationButton user={data.user} relation={data.relation} onChange={reload} />
            ) : (
              <ButtonLink href={`/account?next=/u/${data.user.username}`} variant="primary" size="sm">
                {ts("addFriend")}
              </ButtonLink>
            )}
            {friends && (
              <>
                <ButtonLink href={`/inbox?with=${data.user.username}`} variant="secondary" size="sm" icon={<Icon name="bell" />}>
                  {t("message")}
                </ButtonLink>
                <ButtonLink href={`/expedition?duel=${data.user.username}`} variant="play" size="sm" icon={<Icon name="swords" />}>
                  {t("challenge")}
                </ButtonLink>
              </>
            )}
            <ShareKey text={profileUrl} label={t("shareProfile")} size="sm" />
          </div>
        </div>
      </Card>

      {data.private ? (
        <EmptyState icon={<Icon name="people" />} title={t("privateTitle")}>
          {t("privateLead", { name: data.user.name })}
        </EmptyState>
      ) : (
        <>
          <dl className="mb-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label={ts("statPoints")} value={formatNumber(data.stats.points, locale)} tone="accent" />
            <StatTile label={ts("statPuzzles")} value={formatNumber(data.stats.puzzles, locale)} />
            <StatTile label={ts("statDays")} value={data.stats.days} />
            <StatTile label={ts("statStreak")} value={data.stats.streak} tone="streak" />
            <StatTile label={ts("statLongest")} value={data.stats.longest} tone="streak" />
            <StatTile label={ts("statFullDays")} value={data.stats.fullDays} tone="success" />
          </dl>

          <Card className="mb-5">
            <CardHeader eyebrow={t("highlights")} title={t("favouriteGames")} level={2} />
            {played.length === 0 ? (
              <EmptyState icon={<Icon name="play" />} title={t("noGamesYet")} className="!py-6" />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-3">
                {played.slice(0, 3).map((entry) => {
                  const game = gameBySlug(entry.game);
                  return (
                    <li key={entry.game}>
                      <Link
                        href={`/play/${entry.game}`}
                        className="flex items-center gap-3 rounded-md border border-line-strong bg-sunken/60 p-3 transition-colors hover:border-accent/70"
                        style={{ "--fam": `var(--color-family-${game.family})` } as React.CSSProperties}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-(--fam)/15 text-(--fam) [&>svg]:size-6">
                          <FamilyIcon family={game.family} />
                        </span>
                        <span className="min-w-0">
                          <b className="block truncate text-fg">{GAME_TITLES[entry.game]}</b>
                          <small className="font-mono text-xs text-fg-2">
                            {t("bestScore", { points: formatNumber(entry.best, locale) })} · {t("playedTimes", { n: entry.played })}
                          </small>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <section className="panel">
            <h2 className="eyebrow">{ts("activity")}</h2>
            <ActivityGraph activity={data.activity} today={today} />
          </section>

          {played.length > 0 && (
            <section className="panel">
              <h2 className="eyebrow">{ts("byGame")}</h2>
              <table className="game-table">
                <thead>
                  <tr>
                    <th scope="col">{ts("game")}</th>
                    <th scope="col">{ts("statPuzzles")}</th>
                    <th scope="col">{ts("statAverage")}</th>
                    <th scope="col">{ts("statBest")}</th>
                  </tr>
                </thead>
                <tbody>
                  {played.map((row) => (
                    <tr key={row.game}>
                      <th scope="row">{GAME_TITLES[row.game]}</th>
                      <td>{row.played}</td>
                      <td>{formatNumber(Math.round(row.points / row.played), locale)}</td>
                      <td>{formatNumber(row.best, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  );
}
