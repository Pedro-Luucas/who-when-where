"use client";

import Link from "next/link";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { Avatar } from "./avatar";
import { getFriends } from "./client";
import { useHubT } from "./hub-messages";
import { useRemote } from "./remote";

/** On the player's own profile: their friends, with today's score, and a way to find more. */
export function MyFriends() {
  const { t, locale } = useHubT();
  const day = useDayNumber();
  const friends = useRemote(day >= 1 ? `friends:${day}` : null, () => getFriends(day));
  const list = [...(friends.data?.friends ?? [])].sort((a, b) => (b.today?.points ?? -1) - (a.today?.points ?? -1));
  if (!friends.data) return null;

  return (
    <Card className="mb-5">
      <CardHeader
        eyebrow={t("myFriendsCount", { n: list.length })}
        title={t("myFriendsTitle")}
        level={2}
        action={
          <Link href="/community" className="panel-link">
            {t("homeCommunityOpen")} →
          </Link>
        }
      />
      {list.length === 0 ? (
        <div className="hub-empty">
          <p>{t("noFriendsLead")}</p>
          <ButtonLink href="/community" variant="secondary" size="sm" icon={<Icon name="people" size={15} />}>
            {t("findFriends")}
          </ButtonLink>
        </div>
      ) : (
        <ul className="my-friends">
          {list.map(({ user, today }) => (
            <li key={user.id}>
              <Link href={`/u/${encodeURIComponent(user.username)}`}>
                <Avatar name={user.name} color={user.avatar} online={user.online} />
                <b>{user.name}</b>
                <small>{today ? `${formatNumber(today.points, locale)} ${t("ptsToday")}` : t("notPlayedToday")}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
