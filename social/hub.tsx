"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { usePersistent } from "@/lib/storage";
import { timeLeft, useMinute, weekOfDay } from "@/lib/weeks";
import { Avatar } from "./avatar";
import { addFriend, getFriends, getLeaderboard, listParties } from "./client";
import { getLeague, getWeeklyBoard, type League, type WeeklyBoard } from "./connect";
import { tierKey, useConnectT } from "./connect-messages";
import type { Member } from "./gate";
import { useHubT, type HubKey } from "./hub-messages";
import { useRemote } from "./remote";
import { ShareKey } from "./share-key";
import { TierShield } from "./tier-badge";

// The top of /community: where the player stands this week (league, Weekly
// Special), a way into a party or a challenge, today's board among friends and
// who is online. Every part reads an endpoint the API already has; one that
// fails (an older API, a network blip) just shows its quieter line.

const EVERY_MS = 60_000;

export function CommunityHub({ me }: { me: Member }) {
  const { t } = useHubT();
  const day = useDayNumber();
  const week = day >= 1 ? weekOfDay(day) : 0;
  const league = useRemote("hub:league", getLeague, EVERY_MS);
  const weekly = useRemote(week ? `hub:weekly:${week}` : null, () => getWeeklyBoard(week), EVERY_MS);
  const friends = useRemote(day >= 1 ? `friends:${day}` : null, () => getFriends(day), EVERY_MS);
  return (
    <section className="hub" aria-label={t("hubEyebrow")}>
      <GettingStarted
        me={me}
        hasFriend={friends.data ? friends.data.friends.length > 0 : null}
        inLeague={league.data ? !!league.data.group : league.error ? true : null}
        playedWeekly={weekly.data ? !!weekly.data.me : weekly.error ? true : null}
      />
      <HubCards meId={me.id} league={league.data} weekly={weekly.data} />
      <div className="hub-row">
        <FriendsToday me={me} />
        <div className="hub-side">
          <OnlineNow />
          <Suggested me={me} />
        </div>
      </div>
    </section>
  );
}

const DISMISSED_KEY = "community:getting-started-dismissed";

/**
 * A short checklist for someone new to the social side: a first friend, a
 * league, a flag, the Weekly Special. Gone once all are done, or dismissed.
 * A step whose answer is still loading (null) is left out of the count.
 */
function GettingStarted({
  me,
  hasFriend,
  inLeague,
  playedWeekly,
}: {
  me: Member;
  hasFriend: boolean | null;
  inLeague: boolean | null;
  playedWeekly: boolean | null;
}) {
  const { t } = useHubT();
  const [dismissed, setDismissed] = usePersistent(DISMISSED_KEY, false);
  if (dismissed || hasFriend === null || inLeague === null || playedWeekly === null) return null;
  const steps: { done: boolean; title: HubKey; href: string }[] = [
    { done: hasFriend, title: "startFriend", href: "#friends-heading" },
    { done: inLeague, title: "startLeague", href: "/daily" },
    { done: !!me.country, title: "startFlag", href: "/account" },
    { done: playedWeekly, title: "startWeekly", href: "/weekly" },
  ];
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;

  return (
    <section className="hub-start" aria-labelledby="hub-start">
      <header>
        <div>
          <h2 id="hub-start">{t("startTitle")}</h2>
          <p>{t("startLead", { done, total: steps.length })}</p>
        </div>
        <button type="button" className="link-button" onClick={() => setDismissed(true)}>
          {t("startHide")}
        </button>
      </header>
      <span className="hub-start-meter" aria-hidden="true">
        <i style={{ width: `${(done / steps.length) * 100}%` }} />
      </span>
      <ol>
        {steps.map((step) => (
          <li key={step.title} data-done={step.done ? "" : undefined}>
            <span className="hub-start-tick" aria-hidden="true">
              {step.done ? <Icon name="check" size={14} /> : null}
            </span>
            {step.done ? (
              <s>{t(step.title)}</s>
            ) : (
              <Link href={step.href}>{t(step.title)}</Link>
            )}
            <span className="sr-only">{step.done ? ` (${t("startDone")})` : ""}</span>
          </li>
        ))}
      </ol>
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

function HubCards({ meId, league, weekly }: { meId: string; league?: League; weekly?: WeeklyBoard }) {
  const { t, locale } = useHubT();
  const { t: tc } = useConnectT();
  const now = useMinute();
  const parties = useRemote("hub:parties", listParties, EVERY_MS);

  const tier = league?.tier ?? 0;
  const group = league?.group;
  const myRow = group?.rows.find((row) => row.user.id === meId);
  const leagueLine = myRow
    ? t("cardLeagueRank", { rank: myRow.rank, size: group?.rows.length ?? 0, tier: tc(tierKey(tier)) })
    : t("cardLeagueIdle", { tier: tc(tierKey(tier)) });

  const left = weekly && now ? timeLeft(weekly.endsAt, now) : "";
  const weeklyLine = weekly?.me
    ? t("cardWeeklyMine", { rank: weekly.me.rank, points: formatNumber(weekly.me.points, locale), left })
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

export function FriendsToday({ me }: { me: Pick<Member, "id"> & { username?: string | null } }) {
  const { t, locale } = useHubT();
  const { t: tc } = useConnectT();
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
        <div className="hub-empty">
          <p>
            <b>{t("noFriendsYet")}</b> {t("noFriendsLead")}
          </p>
          {"username" in me && me.username && (
            <ShareKey
              text={() => [tc("inviteShareText"), `${window.location.origin}/i/${me.username}`].join("\n")}
              label={tc("sendLink")}
              variant="primary"
              size="sm"
            />
          )}
        </div>
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

/**
 * Players worth adding: this week's most active, minus the viewer, their
 * friends and anyone a request is already waiting on. The first nudge into
 * the social side for someone with no friends yet.
 */
function Suggested({ me }: { me: Pick<Member, "id"> }) {
  const { t } = useHubT();
  const day = useDayNumber();
  const week = useRemote(day >= 1 ? `hub:suggest:${day}` : null, () =>
    getLeaderboard({ day, period: "week", scope: "all", game: "all" }),
  );
  const friends = useRemote(day >= 1 ? `friends:${day}` : null, () => getFriends(day), EVERY_MS);
  const [asked, setAsked] = useState<Record<string, "sent" | "busy" | "failed">>({});
  if (!week.data || !friends.data) return null;

  const known = new Set([
    me.id,
    ...friends.data.friends.map((entry) => entry.user.id),
    ...friends.data.incoming.map((user) => user.id),
    ...friends.data.outgoing.map((user) => user.id),
  ]);
  const picks = week.data.rows.filter((row) => !known.has(row.user.id) || asked[row.user.id]).slice(0, 4);
  if (picks.length === 0) return null;

  async function add(id: string, username: string) {
    setAsked((previous) => ({ ...previous, [id]: "busy" }));
    try {
      await addFriend(username);
      setAsked((previous) => ({ ...previous, [id]: "sent" }));
    } catch {
      setAsked((previous) => ({ ...previous, [id]: "failed" }));
    }
  }

  return (
    <section className="hub-panel hub-suggest" aria-labelledby="hub-suggest">
      <header className="hub-panel-head">
        <div>
          <h2 id="hub-suggest">{t("suggestTitle")}</h2>
          <p>{t("suggestLead")}</p>
        </div>
      </header>
      <ul className="hub-suggest-list">
        {picks.map((row) => {
          const state = asked[row.user.id];
          return (
            <li key={row.user.id}>
              <Link href={`/u/${encodeURIComponent(row.user.username)}`} className="hub-who">
                <Avatar name={row.user.name} color={row.user.avatar} online={row.user.online} />
                <span className="min-w-0">
                  <b>{row.user.name}</b>
                  <small>@{row.user.username}</small>
                </span>
              </Link>
              <button
                type="button"
                className="chip"
                data-state={state}
                disabled={state === "busy" || state === "sent"}
                onClick={() => void add(row.user.id, row.user.username)}
              >
                {state === "sent" ? t("suggestSent") : state === "failed" ? t("suggestRetry") : `+ ${t("suggestAdd")}`}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
