"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrowserOnly } from "@/components/controls";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, tabPanelProps } from "@/components/ui/tabs";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { useMinute } from "@/lib/weeks";
import { Avatar, Player } from "./avatar";
import { RoomChat } from "./chat";
import { getFriends, type PublicUser } from "./client";
import { Invitations } from "./community";
import { getInbox, listChallenges, markInboxRead, type Notice } from "./connect";
import { agoKey, isMissingFeature, useConnectT, type ConnectKey } from "./connect-messages";
import { Members, type Member } from "./gate";
import { socialError, useSocialT } from "./messages";
import { PushCard } from "./push-card";
import { refreshPulse, usePulse } from "./pulse";
import { useRemote } from "./remote";
import { SocialTabs } from "./tabs";

// /inbox: what happened while the player was away (challenges, friend
// requests, people joining with their link), their conversations, and their
// challenges. Opening it marks the notifications read.

type Tab = "news" | "messages" | "challenges";
const TABS: Tab[] = ["news", "messages", "challenges"];
const EVERY_MS = 20_000;

export function InboxPage() {
  return (
    <BrowserOnly>
      <Members tab="inbox">{(me) => <Inbox me={me} />}</Members>
    </BrowserOnly>
  );
}

function Inbox({ me }: { me: Member }) {
  const { t } = useConnectT();
  const search = useSearchParams();
  const router = useRouter();
  const withName = search.get("with")?.toLowerCase() ?? null;
  const asked = search.get("tab");
  const [tab, setTab] = useState<Tab>(withName ? "messages" : TABS.includes(asked as Tab) ? (asked as Tab) : "news");
  const inbox = useRemote("inbox", getInbox, EVERY_MS);
  const pulse = usePulse();
  const unreadDms = pulse.unread.reduce((sum, entry) => sum + entry.count, 0);

  // Seeing the notifications is reading them; the badges follow.
  const unread = inbox.data?.unread ?? 0;
  useEffect(() => {
    if (unread > 0) void markInboxRead().then(refreshPulse, () => {});
  }, [unread]);

  return (
    <main className="page">
      <SocialTabs current="inbox" />
      <header className="page-head">
        <h1>{t("inbox")}</h1>
        <p>{t("inboxLead")}</p>
      </header>

      <Invitations />
      <PushCard compact />

      <Tabs
        label={t("inbox")}
        idBase="inbox"
        className="mb-4"
        value={tab}
        onChange={(next) => {
          setTab(next);
          if (withName && next !== "messages") router.replace("/inbox");
        }}
        items={[
          { id: "news", label: t("tabNews"), count: inbox.data?.unread || undefined },
          { id: "messages", label: t("tabMessages"), count: unreadDms || undefined },
          { id: "challenges", label: t("tabChallenges") },
        ]}
      />

      <div {...tabPanelProps("inbox", tab)} className="outline-none">
        {tab === "news" && <News inbox={inbox} />}
        {tab === "messages" && <Messages me={me} inbox={inbox} withName={withName} />}
        {tab === "challenges" && <Challenges />}
      </div>
    </main>
  );
}

type InboxRemote = ReturnType<typeof useRemote<Awaited<ReturnType<typeof getInbox>>>>;

const KIND_ICON: Record<Notice["kind"], IconName> = {
  challenge: "swords",
  challenge_played: "trophy",
  friend_request: "people",
  friend_accepted: "heart",
  invite_joined: "star",
};

function News({ inbox }: { inbox: InboxRemote }) {
  const { locale, t } = useConnectT();
  const { t: ts } = useSocialT();
  const now = useMinute();

  if (inbox.error && !inbox.data) {
    return isMissingFeature(inbox.error) ? (
      <EmptyState icon={<Icon name="bell" />} title={t("inboxOldTitle")}>
        {t("inboxOldLead")}
      </EmptyState>
    ) : (
      <p className="form-error">{ts(socialError(inbox.error))}</p>
    );
  }
  if (!inbox.data) return <div className="skeleton-block h-48" aria-busy="true" />;
  if (inbox.data.notifications.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="bell" />}
        title={t("newsEmptyTitle")}
        action={
          <ButtonLink href="/expedition" variant="secondary">
            {t("newExpedition")}
          </ButtonLink>
        }
      >
        {t("newsEmptyLead")}
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-2">
      {inbox.data.notifications.map((notice) => {
        const name = notice.user?.name ?? t("someone");
        const href =
          notice.kind === "challenge" || notice.kind === "challenge_played"
            ? `/c/${notice.ref}`
            : notice.user
              ? `/u/${notice.user.username}`
              : "/community";
        const ago = agoKey(notice.at, now);
        return (
          <li key={notice.id}>
            <Link
              href={href}
              className="notice-row flex items-center gap-3 rounded-md border border-line-strong bg-surface/70 p-3 transition-colors hover:border-accent/70"
              data-unread={notice.read ? undefined : ""}
            >
              <i className="notice-dot size-2 shrink-0 rounded-full bg-transparent" aria-hidden="true" />
              {notice.user ? (
                <Avatar name={notice.user.name} color={notice.user.avatar} />
              ) : (
                <span className="grid size-[34px] place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon name={KIND_ICON[notice.kind]} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-fg">
                  {t(`n_${notice.kind}` as ConnectKey, {
                    name,
                    points: formatNumber(notice.points ?? 0, locale),
                  })}
                </span>
                <small className="font-mono text-xs text-fg-3">{t(ago.key, { n: ago.n })}</small>
              </span>
              <span className="text-accent" aria-hidden="true">
                <Icon name={KIND_ICON[notice.kind]} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Messages({ me, inbox, withName }: { me: Member; inbox: InboxRemote; withName: string | null }) {
  const { t } = useConnectT();
  const { t: ts } = useSocialT();
  const day = useDayNumber();
  const friends = useRemote("inbox-friends", () => getFriends(day), 30_000);
  const pulse = usePulse();
  const unread = new Map(pulse.unread.map((entry) => [entry.userId, entry.count]));
  const [picked, setPicked] = useState<PublicUser | null>(null);
  const fromLink = withName ? friends.data?.friends.find((entry) => entry.user.username === withName)?.user : undefined;
  const open = picked ?? fromLink ?? null;
  const conversations = inbox.data?.conversations ?? [];
  const talking = new Set(conversations.map((entry) => entry.user.id));
  const others = (friends.data?.friends ?? []).filter((entry) => !talking.has(entry.user.id));

  if (open) {
    return (
      <Card className="panel-chat">
        <header className="mb-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<Icon name="back" />} onClick={() => setPicked(null)}>
            {t("back")}
          </Button>
          <Player user={open} presence />
        </header>
        <h2 className="sr-only">{t("dmWith", { name: open.name })}</h2>
        <RoomChat key={open.id} room={{ kind: "dm", userId: open.id }} me={me.id} empty={t("dmEmpty", { name: open.name })} />
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      {conversations.length > 0 ? (
        <ul className="grid gap-2">
          {conversations.map((entry) => (
            <li key={entry.user.id}>
              <button
                type="button"
                onClick={() => setPicked(entry.user)}
                className="flex w-full items-center gap-3 rounded-md border border-line-strong bg-surface/70 p-3 text-left transition-colors hover:border-accent/70"
              >
                <Avatar name={entry.user.name} color={entry.user.avatar} online={entry.user.online} />
                <span className="min-w-0 flex-1">
                  <b className="block text-fg">{entry.user.name}</b>
                  <small className="block truncate text-fg-2">
                    {entry.last.mine ? `${t("you")}: ` : ""}
                    {entry.last.body}
                  </small>
                </span>
                {(unread.get(entry.user.id) ?? entry.unread) > 0 && (
                  <i className="badge">{unread.get(entry.user.id) ?? entry.unread}</i>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        inbox.data && (
          <EmptyState icon={<Icon name="bell" />} title={t("messagesEmptyTitle")}>
            {t("messagesEmptyLead")}
          </EmptyState>
        )
      )}

      <section>
        <h2 className="eyebrow mb-2">{t("startConversation")}</h2>
        {friends.error && !friends.data && <p className="form-error">{ts(socialError(friends.error))}</p>}
        {friends.data && friends.data.friends.length === 0 ? (
          <EmptyState
            icon={<Icon name="people" />}
            title={t("noFriendsTitle")}
            action={
              <ButtonLink href="/community" variant="secondary">
                {t("findPlayers")}
              </ButtonLink>
            }
          >
            {t("noFriendsLead")}
          </EmptyState>
        ) : (
          <ul className="people">
            {others.map(({ user }) => (
              <li key={user.id}>
                <Player user={user} presence />
                <button type="button" className="chip" onClick={() => setPicked(user)}>
                  {t("message")}
                  {unread.has(user.id) && <i className="badge">{unread.get(user.id)}</i>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Challenges() {
  const { locale, t } = useConnectT();
  const list = useRemote("my-challenges", listChallenges, 30_000);

  if (list.error && !list.data) {
    return (
      <EmptyState icon={<Icon name="swords" />} title={isMissingFeature(list.error) ? t("unavailableTitle") : t("errGeneric")}>
        {t("unavailableLead")}
      </EmptyState>
    );
  }
  if (!list.data) return <div className="skeleton-block h-48" aria-busy="true" />;
  if (list.data.challenges.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="swords" />}
        title={t("challengesEmptyTitle")}
        action={
          <ButtonLink href="/expedition" variant="play">
            {t("newExpedition")}
          </ButtonLink>
        }
      >
        {t("challengesEmptyLead")}
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-2">
      {list.data.challenges.map((entry) => (
        <li key={entry.id}>
          <Link
            href={`/c/${entry.id}`}
            className="flex items-center gap-3 rounded-md border border-line-strong bg-surface/70 p-3 transition-colors hover:border-accent/70"
          >
            <Avatar name={entry.from.name} color={entry.from.avatar} />
            <span className="min-w-0 flex-1">
              <b className="block text-fg">
                {entry.from.name}
                {entry.to ? <small className="ml-2 font-normal text-fg-2">{t("sentTo", { name: entry.to.name })}</small> : null}
              </b>
              <small className="font-mono text-xs text-fg-3">
                {t("players", { n: entry.players })} · {t("bestScored", { points: formatNumber(entry.best, locale) })}
              </small>
            </span>
            {entry.mine === null ? (
              <Chip tone="accent">{t("yourTurn")}</Chip>
            ) : (
              <Chip tone="success">{t("youScored", { points: formatNumber(entry.mine, locale) })}</Chip>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
