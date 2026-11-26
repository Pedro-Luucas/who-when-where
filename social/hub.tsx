"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { timeLeft, useMinute, weekOfDay } from "@/lib/weeks";
import { Avatar } from "./avatar";
import { getFriends, getLeaderboard, listParties } from "./client";
import { getLeague, getWeeklyBoard } from "./connect";
import { tierKey, useConnectT } from "./connect-messages";
import type { Member } from "./gate";
import { useHubT } from "./hub-messages";
import { useRemote } from "./remote";
import { TierShield } from "./tier-badge";

// The top of /community: where the player stands this week (league, Weekly
// Special), a way into a party or a challenge, today's board among friends and
// who is online. Every part reads an endpoint the API already has; one that
// fails (an older API, a network blip) just shows its quieter line.

const EVERY_MS = 60_000;

export function CommunityHub({ me }: { me: Member }) {
  const { t } = useHubT();
  return (
    <section className="hub" aria-label={t("hubEyebrow")}>
      <HubCards meId={me.id} />
      <div className="hub-row">
        <FriendsToday me={me} />
        <OnlineNow />
      </div>
    </section>
  );
}

function HubCard({ href, icon, title, line, accent }: { href: string; icon: React.ReactNode; title: string; line: string; accent?: string }) {
  return (
    <Link href={href} className="hub-card" style={accent ? ({ "--hub-accent": accent } as React.CSSProperties) : undefined}>
      <span className="hub-card-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <b>{title}</b>
        <small>{line}</small>
      </span>
      <span className="hub-card-go" aria-hidden="true">
        <Icon name="chevron" size={16} />
      </span>
    </Link>
  );
}

const glyph = (name: IconName) => <Icon name={name} size={20} />;

function HubCards({ meId }: { meId: string }) {
  const { t, locale } = useHubT();
  const { t: tc } = useConnectT();
  const now = useMinute();
  const day = useDayNumber();
  const week = day >= 1 ? weekOfDay(day) : 0;
  const league = useRemote("hub:league", getLeague, EVERY_MS);
  const weekly = useRemote(week ? `hub:weekly:${week}` : null, () => getWeeklyBoard(week), EVERY_MS);
  const parties = useRemote("hub:parties", listParties, EVERY_MS);

  const tier = league.data?.tier ?? 0;
  const group = league.data?.group;
  const myRow = group?.rows.find((row) => row.user.id === meId);
  const leagueLine = myRow
    ? t("cardLeagueRank", { rank: myRow.rank, size: group?.rows.length ?? 0, tier: tc(tierKey(tier)) })
    : t("cardLeagueIdle", { tier: tc(tierKey(tier)) });

  const left = weekly.data && now ? timeLeft(weekly.data.endsAt, now) : "";
  const weeklyLine = weekly.data?.me
    ? t("cardWeeklyMine", { rank: weekly.data.me.rank, points: formatNumber(weekly.data.me.points, locale), left })
    : left
      ? t("cardWeeklyIdle", { left })
      : tc("weeklyBoard");

  const open = parties.data?.open.length ?? 0;

  return (
    <nav className="hub-cards" aria-label={t("hubEyebrow")}>
      <HubCard href="/league" icon={<TierShield tier={tier} size={24} />} title={t("cardLeague")} line={leagueLine} accent="var(--color-gold)" />
      <HubCard href="/weekly" icon={glyph("sparkle")} title={t("cardWeekly")} line={weeklyLine} accent="var(--color-purple)" />
      <HubCard
        href="/party"
        icon={glyph("party")}
        title={t("cardParty")}
        line={open > 0 ? t("cardPartyOpen", { n: open }) : t("cardPartyNone")}
        accent="var(--color-green)"
      />
      <HubCard href="/expedition" icon={glyph("swords")} title={t("cardChallenge")} line={t("cardChallengeLead")} accent="var(--color-pink)" />
    </nav>
  );
}

export function FriendsToday({ me }: { me: Pick<Member, "id"> }) {
  const { t, locale } = useHubT();
  const day = useDayNumber();
  const board = useRemote(
    day >= 1 ? `hub:friends-day:${day}:${me.id}` : null,
    () => getLeaderboard({ day, period: "day", scope: "friends", game: "all" }),
    EVERY_MS,
  );
  const friends = useRemote(day >= 1 ? `friends:${day}` : null, () => getFriends(day), EVERY_MS);
  const rows = board.data?.rows ?? [];
  const noFriends = friends.data ? friends.data.friends.length === 0 : false;
  const top = rows.slice(0, 5);
  const mine = rows.find((row) => row.user.id === me.id);
  const extra = mine && mine.rank > 5 ? mine : null;

  return (
    <section className="hub-panel hub-today" aria-labelledby="hub-today">
      <header className="hub-panel-head">
        <div>
          <h2 id="hub-today">{t("todayWithFriends")}</h2>
          <p>{t("todayWithFriendsLead")}</p>
        </div>
        <Link href="/leaderboard" className="panel-link">
          {t("fullBoard")} →
        </Link>
      </header>
      {noFriends ? (
        <p className="hub-empty">
          <b>{t("noFriendsYet")}</b> {t("noFriendsLead")}
        </p>
      ) : !board.data ? (
        <div className="skeleton-block h-32" aria-busy="true" />
      ) : top.length === 0 ? (
        <div className="hub-empty">
          <p>{t("nobodyPlayed")}</p>
          <ButtonLink href="/daily" variant="play" size="sm" icon={<Icon name="play" size={15} />}>
            {t("playToday")}
          </ButtonLink>
        </div>
      ) : (
        <ol className="hub-board">
          {[...top, ...(extra ? [extra] : [])].map((row) => {
            const self = row.user.id === me.id;
            return (
              <li key={row.user.id} data-rank={row.rank <= 3 ? row.rank : undefined} data-me={self ? "" : undefined}>
                <span className="hub-rank">{row.rank}</span>
                <Link href={`/u/${encodeURIComponent(row.user.username)}`} className="hub-who">
                  <Avatar name={row.user.name} color={row.user.avatar} />
                  <span className="min-w-0">
                    <b>
                      {row.user.name}
                      {self && <em> · {t("you")}</em>}
                    </b>
                    <small>@{row.user.username}</small>
                  </span>
                </Link>
                <span className="hub-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((row.points / Math.max(1, top[0]?.points ?? 1)) * 100)}%` }} />
                </span>
                <strong>{formatNumber(row.points, locale)}</strong>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function OnlineNow() {
  const { t } = useHubT();
  const day = useDayNumber();
  const friends = useRemote(day >= 1 ? `friends:${day}` : null, () => getFriends(day), EVERY_MS);
  const online = (friends.data?.friends ?? []).filter((entry) => entry.user.online);

  return (
    <section className="hub-panel hub-online" aria-labelledby="hub-online">
      <header className="hub-panel-head">
        <h2 id="hub-online">
          <i className="hub-live" aria-hidden="true" /> {t("onlineNow")}
          {online.length > 0 && <span className="hub-count">{online.length}</span>}
        </h2>
      </header>
      {!friends.data ? (
        <div className="skeleton-block h-16" aria-busy="true" />
      ) : online.length === 0 ? (
        <p className="hub-empty">{t("onlineNone")}</p>
      ) : (
        <ul className="hub-faces">
          {online.map(({ user }) => (
            <li key={user.id}>
              <Link href={`/u/${encodeURIComponent(user.username)}`} title={`@${user.username}`}>
                <Avatar name={user.name} color={user.avatar} online />
                <span>{user.name.split(" ")[0]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** For a visitor at the door of a community page: who is on top today, and what an account adds. */
export function GuestTeaser() {
  const { t, locale } = useHubT();
  const day = useDayNumber();
  const board = useRemote(day >= 1 ? `hub:guest-day:${day}` : null, () =>
    getLeaderboard({ day, period: "day", scope: "all", game: "all" }),
  );
  const rows = (board.data?.rows ?? []).slice(0, 5);
  const pitch: { icon: IconName; key: Parameters<typeof t>[0] }[] = [
    { icon: "people", key: "pitchFriends" },
    { icon: "medal", key: "pitchLeague" },
    { icon: "party", key: "pitchParty" },
    { icon: "swords", key: "pitchChallenge" },
  ];

  return (
    <aside className="guest-teaser" aria-label={t("homePitchTitle")}>
      <section className="hub-panel">
        <header className="hub-panel-head">
          <h2>{t("guestTopToday")}</h2>
        </header>
        {rows.length === 0 ? (
          <p className="hub-empty">{t("nobodyPlayed")}</p>
        ) : (
          <ol className="hub-board">
            {rows.map((row) => (
              <li key={row.user.id} data-rank={row.rank <= 3 ? row.rank : undefined}>
                <span className="hub-rank">{row.rank}</span>
                <Link href={`/u/${encodeURIComponent(row.user.username)}`} className="hub-who">
                  <Avatar name={row.user.name} color={row.user.avatar} />
                  <span className="min-w-0">
                    <b>{row.user.name}</b>
                    <small>@{row.user.username}</small>
                  </span>
                </Link>
                <span className="hub-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((row.points / Math.max(1, rows[0]?.points ?? 1)) * 100)}%` }} />
                </span>
                <strong>{formatNumber(row.points, locale)}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="hub-panel">
        <header className="hub-panel-head">
          <h2>{t("homePitchTitle")}</h2>
        </header>
        <ul className="guest-pitch">
          {pitch.map((item) => (
            <li key={item.key}>
              <span aria-hidden="true">
                <Icon name={item.icon} size={18} />
              </span>
              {t(item.key)}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
