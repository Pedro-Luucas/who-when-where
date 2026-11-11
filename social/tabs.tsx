"use client";

import Link from "next/link";
import { useSocialT } from "./messages";
import { pulseCount, usePulse } from "./pulse";

const TABS = [
  { id: "community", href: "/community" },
  { id: "leaderboard", href: "/leaderboard" },
  { id: "party", href: "/party" },
  { id: "expedition", href: "/expedition" },
] as const;

export type SocialTab = (typeof TABS)[number]["id"];

/** The way between the community's pages, shown at the top of each. */
export function SocialTabs({ current }: { current?: SocialTab }) {
  const { t } = useSocialT();
  const waiting = pulseCount(usePulse());
  return (
    <nav className="social-tabs" aria-label={t("community")}>
      {TABS.map((tab) => (
        <Link key={tab.id} href={tab.href} aria-current={tab.id === current ? "page" : undefined}>
          {t(tab.id)}
          {tab.id === "community" && waiting > 0 && <i className="badge">{waiting}</i>}
        </Link>
      ))}
    </nav>
  );
}
