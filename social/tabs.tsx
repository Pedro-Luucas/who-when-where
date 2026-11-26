"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "@/components/shell/nav-items";
import { useConnectT } from "./connect-messages";
import { useSocialT } from "./messages";
import { pulseCount, usePulse } from "./pulse";

const TABS = [
  { id: "community", href: "/community", icon: "people" },
  { id: "inbox", href: "/inbox", icon: "bell" },
  { id: "league", href: "/league", icon: "medal" },
  { id: "leaderboard", href: "/leaderboard", icon: "trophy" },
  { id: "weekly", href: "/weekly", icon: "sparkle" },
  { id: "party", href: "/party", icon: "party" },
  { id: "expedition", href: "/expedition", icon: "compass" },
] as const satisfies readonly { id: string; href: string; icon: IconName }[];

export type SocialTab = (typeof TABS)[number]["id"];

/**
 * The way between the community's pages, shown at the top of each. One row
 * that scrolls sideways when it does not fit (phones), with the current page
 * brought into view.
 */
export function SocialTabs({ current }: { current?: SocialTab }) {
  const { t } = useSocialT();
  const { t: tc } = useConnectT();
  const waiting = pulseCount(usePulse());
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const row = nav.current;
    const here = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !here) return;
    // Only when it is cut off: bring it in with a little room, without moving the page itself.
    const start = here.offsetLeft - row.offsetLeft;
    const end = start + here.offsetWidth;
    if (start < row.scrollLeft) row.scrollLeft = Math.max(0, start - 24);
    else if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth + 24;
  }, [current]);

  return (
    <nav ref={nav} className="social-tabs" aria-label={t("community")}>
      {TABS.map((tab) => (
        <Link key={tab.id} href={tab.href} aria-current={tab.id === current ? "page" : undefined}>
          <span className="social-tab-icon" aria-hidden="true">
            <Icon name={tab.icon} />
          </span>
          {tab.id === "inbox" || tab.id === "league" || tab.id === "weekly" ? tc(tab.id) : t(tab.id)}
          {tab.id === "inbox" && waiting > 0 && <i className="badge">{waiting}</i>}
        </Link>
      ))}
    </nav>
  );
}
