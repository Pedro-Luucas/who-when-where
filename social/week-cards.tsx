"use client";

import Link from "next/link";
import { useAccount } from "@/account/state";
import { Icon } from "@/components/shell/nav-items";
import { Chip } from "@/components/ui/chip";
import { FamilyIcon } from "@/components/ui/family-icon";
import { isRunOver, runTotal } from "@/expedition/run";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { weekOfDay } from "@/lib/weeks";
import { getLeague } from "./connect";
import { tierKey, useConnectT } from "./connect-messages";
import { useRemote } from "./remote";
import { TierShield } from "./tier-badge";
import { themeOfWeek, useWeeklyRun } from "./weekly-special";

// The week's two extras beside the dailies (on /daily): the Weekly Special
// and the player's league standing.

export function WeekCards() {
  return (
    <div className="grid gap-3">
      <WeeklyCard />
      <LeagueCard />
    </div>
  );
}

const cardClass =
  "flex items-center gap-3 rounded-lg border border-line-strong bg-(image:--panel-fill) p-4 shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/70";

function WeeklyCard() {
  const { locale, t } = useConnectT();
  const day = useDayNumber();
  const week = weekOfDay(Math.max(1, day));
  const theme = themeOfWeek(week);
  const [stored] = useWeeklyRun(week);
  const done = stored.run && isRunOver(stored.run) ? runTotal(stored.run.results) : null;

  return (
    <Link href="/weekly" className={cardClass} style={{ "--fam": `var(--color-family-${theme.family})` } as React.CSSProperties}>
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-(--fam)/15 text-(--fam) [&>svg]:size-7">
        <FamilyIcon family={theme.family} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">{t("weekly")}</span>
        <b className="block truncate text-fg">{theme.title[locale]}</b>
      </span>
      {done !== null ? (
        <Chip tone="success">{t("weeklyCardDone", { points: formatNumber(done, locale) })}</Chip>
      ) : (
        <Chip tone="new" icon={<Icon name="sparkle" size={12} />}>
          {t("weekNo", { n: week })}
        </Chip>
      )}
    </Link>
  );
}

function LeagueCard() {
  const { t } = useConnectT();
  const account = useAccount();
  const me = account.status === "user" && account.account.username ? account.account : null;
  const league = useRemote(me ? `league-card:${me.id}` : null, getLeague, 60_000);
  const data = league.data;
  const row = data?.group?.rows.find((entry) => entry.user.id === me?.id);
  // Without an account, or with an API from before leagues, the card just leads to the page.
  const tier = data?.tier ?? 0;

  return (
    <Link href="/league" className={cardClass}>
      <TierShield tier={tier} size={44} />
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">{t("leagueTitle")}</span>
        <b className="block truncate text-fg">
          {data && row && data.group
            ? t("leagueCardLead", { rank: row.rank, size: data.group.rows.length, tier: t(tierKey(tier)) })
            : data
              ? t("leagueCardJoin", { tier: t(tierKey(tier)) })
              : t("leagueGuestTitle")}
        </b>
      </span>
      <Icon name="chevron" />
    </Link>
  );
}
