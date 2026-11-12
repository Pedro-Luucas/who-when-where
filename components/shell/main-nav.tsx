"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useShellT } from "@/lib/shell-messages";
import { GATING } from "@/shared/plans";
import { pulseCount, usePulse } from "@/social/pulse";
import { COMMUNITY, HEADER_NAV, Icon, PRICING, type NavItem } from "./nav-items";

/** The pills; Pricing joins them while the plans are shown (the switch in shared/plans.ts). */
const PILLS = GATING === "off" ? HEADER_NAV : [...HEADER_NAV, PRICING];

/** The header's pills: Play, Daily, Leaderboard, Community, Party. The current place is lit. */
export function MainNav() {
  return (
    // The address is known when each page is built; the boundary only covers an unknown game's address.
    <Suspense fallback={<Pills path="" />}>
      <CurrentPills />
    </Suspense>
  );
}

function CurrentPills() {
  return <Pills path={usePathname()} />;
}

function Pills({ path }: { path: string }) {
  const t = useShellT();
  const waiting = pulseCount(usePulse());
  return (
    <nav className="main-nav" aria-label={t("mainNav")}>
      {PILLS.map((item: NavItem) => (
        <Link
          key={item.href}
          href={item.href}
          className="main-nav-pill"
          data-kind={item.href === "/play" ? "play" : item === PRICING ? "pro" : undefined}
          aria-current={item.match(path) ? "page" : undefined}
          aria-label={item === PRICING ? t(item.label) : undefined}
          title={item === PRICING ? t(item.label) : undefined}
        >
          <Icon name={item.icon} size={16} />
          {/* Pricing's label folds away on narrower screens (app/pro.css). */}
          {item === PRICING ? <span className="main-nav-text">{t(item.label)}</span> : t(item.label)}
          {item === COMMUNITY && waiting > 0 && <i className="badge">{waiting > 9 ? "9+" : waiting}</i>}
        </Link>
      ))}
    </nav>
  );
}
