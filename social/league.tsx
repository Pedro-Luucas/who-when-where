"use client";

import { Fragment } from "react";
import { useAccount } from "@/account/state";
import { BrowserOnly } from "@/components/controls";
import { Icon } from "@/components/shell/nav-items";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/i18n";
import { timeLeft, useMinute } from "@/lib/weeks";
import { Player } from "./avatar";
import { getLeague, type League } from "./connect";
import { isMissingFeature, tierKey, useConnectT } from "./connect-messages";
import { socialError, useSocialT } from "./messages";
import { useRemote } from "./remote";
import { SocialTabs } from "./tabs";
import { TierShield } from "./tier-badge";

// /league: the weekly league. A group of up to 30 players at the same tier,
// ranked by every point scored in the week's dailies; the top of the table
// moves up a tier when the week ends, the bottom moves down.

const EVERY_MS = 30_000;

export function LeaguePage() {
  return (
    <BrowserOnly>
      <LeagueView />
    </BrowserOnly>
  );
}

function LeagueView() {
  const { t } = useConnectT();
  const account = useAccount();
  const me = account.status === "user" ? account.account : null;

  return (
    <main className="page">
      <SocialTabs current="league" />
      <header className="page-head">
        <p className="eyebrow">{t("league")}</p>
        <h1>{t("leagueTitle")}</h1>
        <p>{t("leagueLead")}</p>
      </header>
      {account.status === "loading" && <div className="page-skeleton skeleton-block" aria-busy="true" />}
      {account.status === "guest" && <GuestLeague />}
      {me && <MemberLeague myId={me.id} hasUsername={!!me.username} />}
    </main>
  );
}

/** The five tiers, with the player's own lit. */
export function TierLadder({ current }: { current: number | null }) {
  const { t } = useConnectT();
  return (
    <ol className="tier-ladder" aria-label={t("tiers")}>
      {[0, 1, 2, 3, 4].map((tier) => (
        <li key={tier} data-current={tier === current ? "" : undefined} aria-current={tier === current ? "step" : undefined}>
          <TierShield tier={tier} size={34} />
          {t(tierKey(tier))}
        </li>
      ))}
    </ol>
  );
}

function GuestLeague() {
  const { t } = useConnectT();
  return (
    <Card className="rise-in">
      <TierLadder current={null} />
      <EmptyState
        className="mt-5"
        icon={<Icon name="medal" />}
        title={t("leagueGuestTitle")}
        action={<ButtonLink href="/account?next=/league">{t("signInOrUp")}</ButtonLink>}
      >
        {t("leagueGuestLead")}
      </EmptyState>
    </Card>
  );
}

function MemberLeague({ myId, hasUsername }: { myId: string; hasUsername: boolean }) {
  const { t } = useConnectT();
  const { t: ts } = useSocialT();
  const league = useRemote(`league:${myId}`, getLeague, EVERY_MS);
  const now = useMinute();

  if (league.error && !league.data) {
    return isMissingFeature(league.error) ? (
      <EmptyState icon={<Icon name="medal" />} title={t("unavailableTitle")}>
        {t("unavailableLead")}
      </EmptyState>
    ) : (
      <EmptyState
        icon={<Icon name="medal" />}
        title={ts(socialError(league.error))}
        action={
          <Button variant="secondary" onClick={league.reload}>
            {t("retry")}
          </Button>
        }
      />
    );
  }
  if (!league.data) return <div className="page-skeleton skeleton-block" aria-busy="true" />;
  const data = league.data;
  const tierName = t(tierKey(data.tier));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid content-start gap-5">
        {data.last && <LastWeek last={data.last} />}
        <Card className="rise-in">
          <CardHeader
            eyebrow={`${t("weekNo", { n: data.week })} · ${t("endsIn", { time: now ? timeLeft(data.endsAt, now) : "…" })}`}
            title={
              <span className="flex items-center gap-3">
                <TierShield tier={data.tier} size={36} />
                {data.group ? t("leagueGroup", { tier: tierName, n: data.group.number }) : t("tierBadge", { tier: tierName })}
              </span>
            }
          />
          {data.group ? (
            <Table group={data.group} myId={myId} />
          ) : (
            <EmptyState
              icon={<Icon name="calendar" />}
              title={t("leagueJoinTitle")}
              action={
                hasUsername ? (
                  <ButtonLink href="/daily" variant="play">
                    {t("playDailies")}
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/community" variant="secondary">
                    {ts("pickUsernameAction")}
                  </ButtonLink>
                )
              }
            >
              {hasUsername ? t("leagueJoinLead", { tier: tierName }) : ts("pickUsernameLead")}
            </EmptyState>
          )}
        </Card>
      </div>
      <aside className="grid content-start gap-5">
        <Card>
          <CardHeader eyebrow={t("tiers")} title={tierName} level={3} />
          <TierLadder current={data.tier} />
        </Card>
      </aside>
    </div>
  );
}

function LastWeek({ last }: { last: NonNullable<League["last"]> }) {
  const { t } = useConnectT();
  return (
    <div
      className="rise-in flex items-center gap-3 rounded-lg border p-4"
      style={{
        borderColor: last.outcome === "up" ? "var(--answer)" : last.outcome === "down" ? "var(--danger)" : "var(--line-strong)",
        background:
          last.outcome === "up"
            ? "color-mix(in srgb, var(--answer) 10%, transparent)"
            : last.outcome === "down"
              ? "color-mix(in srgb, var(--danger) 10%, transparent)"
              : "var(--surface)",
      }}
      role="status"
    >
      <TierShield tier={last.newTier} size={34} />
      <p className="text-fg">
        {t(`lastWeek_${last.outcome}`, { rank: last.rank, size: last.size, tier: t(tierKey(last.newTier)) })}
      </p>
    </div>
  );
}

function Table({ group, myId }: { group: NonNullable<League["group"]>; myId: string }) {
  const { locale, t } = useConnectT();
  const { t: ts } = useSocialT();
  const rows = group.rows;
  const relegationStart = rows.length - group.demote;

  return (
    <>
      <ol className="league-table">
        {rows.map((row, index) => (
          <Fragment key={row.user.id}>
            {index === group.promote && group.promote > 0 && index < rows.length && (
              <li className="league-divider" data-zone="up" aria-hidden="true">
                ↑ {t("promotionZone")}
              </li>
            )}
            {index === relegationStart && group.demote > 0 && (
              <li className="league-divider" data-zone="down" aria-hidden="true">
                ↓ {t("relegationZone")}
              </li>
            )}
            <li data-zone={row.zone ?? undefined} data-me={row.user.id === myId ? "" : undefined}>
              <span className="league-rank">{row.rank}</span>
              <Player user={row.user} note={ts("puzzleCount", { n: row.puzzles })} />
              <span className="flex items-center gap-2">
                {row.zone === "up" && <Chip tone="success">↑</Chip>}
                {row.zone === "down" && <Chip tone="danger">↓</Chip>}
                <strong className="league-points">{formatNumber(row.points, locale)}</strong>
              </span>
            </li>
          </Fragment>
        ))}
      </ol>
      {rows.length === 1 && <p className="mt-4 text-sm text-fg-2">{t("leagueAlone")}</p>}
    </>
  );
}
