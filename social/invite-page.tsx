"use client";

import { useEffect } from "react";
import { INVITED_BY_KEY, useAccount } from "@/account/state";
import { BrowserOnly } from "@/components/controls";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { writeStore } from "@/lib/storage";
import { Avatar } from "./avatar";
import { getProfile } from "./client";
import { tierKey, useConnectT } from "./connect-messages";
import { RelationButton } from "./friends";
import { useRemote } from "./remote";
import { TierBadge } from "./tier-badge";

// /i/<username>: where an invitation link lands. It says who sent it and
// what the site is, remembers the inviter on this device (sign-up sends it,
// and the two become friends), and points at today's puzzles.

export function InvitePage({ username }: { username: string }) {
  return (
    <BrowserOnly>
      <Invite username={username} />
    </BrowserOnly>
  );
}

function Invite({ username }: { username: string }) {
  const { t } = useConnectT();
  const account = useAccount();
  const me = account.status === "user" ? account.account : null;
  const viewer = me?.id ?? account.status;
  const profile = useRemote(username ? `invite:${username}:${viewer}` : null, () => getProfile(username));
  const inviter = profile.data?.user;
  const name = inviter?.name ?? `@${username}`;
  const self = me?.username === username;

  useEffect(() => {
    if (username && account.status === "guest") writeStore(INVITED_BY_KEY, username);
  }, [username, account.status]);

  return (
    <main className="page page-narrow">
      <Card className="rise-in mt-6 text-center" family="where">
        <div className="grid justify-items-center gap-4 py-4">
          {inviter ? (
            <Avatar name={inviter.name} color={inviter.avatar} size="large" className="profile-hero-avatar !mt-0" />
          ) : (
            <span className="grid size-[72px] place-items-center rounded-full bg-accent-soft text-accent">
              <Icon name="people" size={34} />
            </span>
          )}
          <p className="eyebrow">Who · When · Where</p>
          <h1 className="font-display text-4xl font-bold text-fg">{t("inviteTitle", { name })}</h1>
          {profile.data && !profile.data.private && (profile.data.leagueTier ?? null) !== null && (
            <TierBadge tier={profile.data.leagueTier ?? 0} label={t("tierBadge", { tier: t(tierKey(profile.data.leagueTier ?? 0)) })} />
          )}
          {self ? (
            <p className="max-w-[48ch] text-fg-2">{t("inviteSelf")}</p>
          ) : profile.error?.code === "no_such_player" ? (
            <p className="max-w-[48ch] text-fg-2">{t("inviteNotFound")}</p>
          ) : (
            <p className="max-w-[52ch] text-fg-2">{t("inviteLead", { name })}</p>
          )}

          {me && !self && profile.data?.relation && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-fg-2">{t("inviteMember", { name })}</span>
              <RelationButton user={profile.data.user} relation={profile.data.relation} onChange={profile.reload} />
            </div>
          )}

          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/daily" variant="play" size="lg" icon={<Icon name="play" />}>
              {t("playDailies")}
            </ButtonLink>
            {account.status === "guest" && (
              <ButtonLink href="/account?mode=signup" variant="primary" size="lg">
                {t("inviteSignup")}
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>
    </main>
  );
}
