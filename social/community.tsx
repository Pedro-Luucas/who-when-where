"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrowserOnly } from "@/components/controls";
import { Avatar } from "./avatar";
import { RoomChat } from "./chat";
import { declineInvite, type PublicUser } from "./client";
import { FriendsPanel } from "./friends";
import { Members, type Member } from "./gate";
import { useSocialT } from "./messages";
import { refreshPulse, usePulse } from "./pulse";
import { SocialTabs } from "./tabs";

/** The community page: friends on one side, the chat rooms on the other. */
export function Community() {
  return (
    <BrowserOnly>
      <Members tab="community">{(me) => <Hall me={me} />}</Members>
    </BrowserOnly>
  );
}

/** Party invitations waiting for the player, each with a way in and a way out. */
export function Invitations() {
  const { t } = useSocialT();
  const router = useRouter();
  const { invites } = usePulse();
  if (!invites.length) return null;

  return (
    <ul className="invites">
      {invites.map((invite) => (
        <li key={invite.code} className="notice">
          <Avatar name={invite.from.name} color={invite.from.avatar} />
          <p>
            {t("invitedBy", { name: invite.from.name })} <b>{invite.name || t("partyOf", { name: invite.from.name })}</b>
          </p>
          <span className="relation">
            <button type="button" className="chip chip-solid" onClick={() => router.push(`/party?code=${invite.code}&join=1`)}>
              {t("join")}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() =>
                void declineInvite(invite.code)
                  .catch(() => {})
                  .then(refreshPulse)
              }
            >
              {t("decline")}
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Hall({ me }: { me: Member }) {
  const { t } = useSocialT();
  // The room on screen: everybody's, or the one shared with a friend.
  const [friend, setFriend] = useState<PublicUser | null>(null);

  return (
    <main className="page">
      <SocialTabs current="community" />
      <header className="page-head">
        <h1>{t("community")}</h1>
        <p>{t("communityLead")}</p>
      </header>

      <Invitations />

      <div className="community">
        <section className="panel" aria-labelledby="friends-heading">
          <header className="panel-head">
            <h2 id="friends-heading">{t("friends")}</h2>
            <Link href={`/player?u=${me.username}`} className="panel-link">
              {t("myProfile")} →
            </Link>
          </header>
          <FriendsPanel
            onMessage={(user) => {
              setFriend(user);
              document.getElementById("chat-heading")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
          />
        </section>

        <section className="panel panel-chat" aria-labelledby="chat-heading">
          <header className="panel-head">
            <h2 id="chat-heading">{t("chat")}</h2>
            <div className="segmented" role="group" aria-label={t("chat")}>
              <button type="button" aria-pressed={!friend} onClick={() => setFriend(null)}>
                {t("globalChat")}
              </button>
              {friend && (
                <button type="button" aria-pressed="true">
                  @{friend.username}
                </button>
              )}
            </div>
          </header>
          {friend ? (
            <RoomChat
              key={friend.id}
              room={{ kind: "dm", userId: friend.id }}
              me={me.id}
              empty={t("dmEmpty", { name: friend.name })}
            />
          ) : (
            <RoomChat key="global" room={{ kind: "global" }} me={me.id} empty={t("globalEmpty")} />
          )}
        </section>
      </div>
    </main>
  );
}
