"use client";

import Link from "next/link";
import { useAccount } from "@/account/state";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { FriendsToday, OnlineNow } from "@/social/hub";
import { useHubT, type HubKey } from "@/social/hub-messages";

const PITCH: { icon: IconName; key: HubKey }[] = [
  { icon: "trophy", key: "pitchBoards" },
  { icon: "medal", key: "pitchLeague" },
  { icon: "party", key: "pitchParty" },
  { icon: "swords", key: "pitchChallenge" },
];

/**
 * The community on the home page: today's board among friends and who is
 * online for a member with a username; for everyone else, what an account adds.
 */
export function HomeCommunity() {
  const { t } = useHubT();
  const account = useAccount();
  if (account.status === "loading") return null;
  const member = account.status === "user" && account.account.username ? account.account : null;

  return (
    <section className="home-community" aria-labelledby="home-community-heading">
      <div className="home-community-head">
        <h2 id="home-community-heading" className="section-heading">
          {member ? t("homeCommunity") : t("homePitchTitle")}
        </h2>
        {member && (
          <Link href="/community" className="panel-link">
            {t("homeCommunityOpen")} →
          </Link>
        )}
      </div>
      {member ? (
        <div className="hub-row">
          <FriendsToday me={member} />
          <OnlineNow />
        </div>
      ) : (
        <div className="home-pitch">
          <p>{t("homePitchLead")}</p>
          <ul>
            {PITCH.map((item) => (
              <li key={item.key}>
                <span aria-hidden="true">
                  <Icon name={item.icon} size={18} />
                </span>
                {t(item.key)}
              </li>
            ))}
          </ul>
          <ButtonLink href={account.status === "user" ? "/community" : "/account?next=/community"} variant="primary">
            {account.status === "user" ? t("homeCommunityOpen") : t("pitchCta")}
          </ButtonLink>
        </div>
      )}
    </section>
  );
}
