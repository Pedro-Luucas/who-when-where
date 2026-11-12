"use client";

import Link from "next/link";
import { useConnectT } from "./connect-messages";
import { useSocialT } from "./messages";
import { pulseCount, usePulse } from "./pulse";

const TABS = [
  { id: "community", href: "/community" },
  { id: "inbox", href: "/inbox" },
  { id: "league", href: "/league" },
  { id: "leaderboard", href: "/leaderboard" },
  { id: "weekly", href: "/weekly" },
  { id: "party", href: "/party" },
  { id: "expedition", href: "/expedition" },
] as const;

export type SocialTab = (typeof TABS)[number]["id"];

/** The way between the community's pages, shown at the top of each. */
export function SocialTabs({ current }: { current?: SocialTab }) {
  const { t } = useSocialT();
  const { t: tc } = useConnectT();
  const waiting = pulseCount(usePulse());
  return (
    <nav className="social-tabs" aria-label={t("community")}>
      {TABS.map((tab) => (
        <Link key={tab.id} href={tab.href} aria-current={tab.id === current ? "page" : undefined}>
          {tab.id === "inbox" || tab.id === "league" || tab.id === "weekly" ? tc(tab.id) : t(tab.id)}
          {tab.id === "inbox" && waiting > 0 && <i className="badge">{waiting}</i>}
        </Link>
      ))}
    </nav>
  );
}
