"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrowserOnly } from "@/components/controls";
import { Avatar } from "./avatar";
import { RoomChat } from "./chat";
import { ClubStrip } from "./clubs";
import { declineInvite, type PublicUser } from "./client";
import { useConnectT } from "./connect-messages";
import { FriendsPanel } from "./friends";
import { CommunityHub } from "./hub";
import { Members, type Member } from "./gate";
import { useSocialT } from "./messages";
import { refreshPulse, usePulse } from "./pulse";
import { ShareKey } from "./share-key";
import { SocialTabs } from "./tabs";

/** The community page: friends first, then the chat. */
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

type Pane = "friends" | "chat";

function Hall({ me }: { me: Member }) {
  const { t } = useSocialT();
  const { t: tc } = useConnectT();
  // The room on screen: everybody's, or the one shared with a friend.
  const [friend, setFriend] = useState<PublicUser | null>(null);
  const [pane, setPane] = useState<Pane>("friends");

  function openChat(user: PublicUser | null) {
    setFriend(user);
    setPane("chat");
  }

  return (
    <main className="page community-page" data-pane={pane}>
      <SocialTabs current="community" />
      <header className="page-head">
        <h1>{t("community")}</h1>
        <p>{t("communityLead")}</p>
      </header>

      <Invitations />

      <CommunityHub me={me} />

      <div className="community-switch" role="tablist" aria-label={t("community")}>
        <button type="button" role="tab" aria-selected={pane === "friends"} onClick={() => setPane("friends")}>
          {t("paneFriends")}
        </button>
        <button type="button" role="tab" aria-selected={pane === "chat"} onClick={() => setPane("chat")}>
          {friend ? friend.name : t("paneChat")}
        </button>
      </div>

      <div className="community">
        <section className="panel friends-pane" aria-labelledby="friends-heading">
          <header className="panel-head">
            <h2 id="friends-heading">{t("friends")}</h2>
            <Link href={`/u/${me.username}`} className="panel-link">
              {t("myProfile")} →
            </Link>
          </header>
          <FriendsPanel roster onMessage={(user) => openChat(user)} />
          <ClubStrip />
          <div className="community-invite">
            <h3>{tc("yourInvite")}</h3>
            <p>{tc("yourInviteLead")}</p>
            <ShareKey
              text={() => [tc("inviteShareText"), `${window.location.origin}/i/${me.username}`].join("\n")}
              label={tc("sendLink")}
              variant="primary"
            />
          </div>
        </section>

        <section className="panel panel-chat" aria-labelledby="chat-heading">
          <header className="panel-head">
            <h2 id="chat-heading">{t("chat")}</h2>
            <div className="segmented" role="group" aria-label={t("chat")}>
              <button type="button" aria-pressed={!friend} onClick={() => openChat(null)}>
                {t("globalChat")}
              </button>
              {friend && (
                <button type="button" aria-pressed="true" onClick={() => setPane("chat")}>
                  {friend.name}
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
