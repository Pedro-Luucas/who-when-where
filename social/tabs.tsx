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

/** Header link to the community, with a badge for whatever is waiting. */
export function CommunityButton() {
  const { t } = useSocialT();
  const waiting = pulseCount(usePulse());
  const label = waiting > 0 ? `${t("community")} (${waiting})` : t("community");
  return (
    <Link href="/community" className="icon-button community-button" aria-label={label} title={label}>
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="5.6" cy="5.4" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M1.3 13.4c.4-2.4 2.1-3.7 4.3-3.7s3.9 1.3 4.3 3.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M10.4 3.3a2.2 2.2 0 0 1 0 4.2M12 9.9c1.5.4 2.5 1.6 2.8 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {waiting > 0 && <i className="badge">{waiting > 9 ? "9+" : waiting}</i>}
    </Link>
  );
}
