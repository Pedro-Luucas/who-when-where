"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useShellT } from "@/lib/shell-messages";
import { pulseCount, usePulse } from "@/social/pulse";
import { DAILY, Icon, PLAY, type NavItem } from "./nav-items";

const HOME: NavItem = { href: "/", label: "navHome", icon: "home", match: (path) => path === "/" };
const SOCIAL: NavItem = {
  href: "/community",
  label: "navSocial",
  icon: "people",
  match: (path) =>
    ["/community", "/leaderboard", "/party", "/player", "/inbox", "/league", "/weekly"].includes(path) ||
    path.startsWith("/u/") ||
    path.startsWith("/c/"),
};
const ME: NavItem = {
  href: "/account",
  label: "navMe",
  icon: "user",
  match: (path) => ["/account", "/logbook", "/expedition"].includes(path),
};

/** A game's own page: its action bar takes the bottom of the screen instead. */
const isGamePage = (path: string) => /^\/play\/[^/]+/.test(path);

/** The phone's bottom bar: Home · Play · Daily · Social · Me. Hidden from the md breakpoint and on game screens. */
export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

function Bar() {
  const t = useShellT();
  const path = usePathname();
  const waiting = pulseCount(usePulse());
  if (isGamePage(path)) return null;
  return (
    <nav className="bottom-nav" aria-label={t("mainNav")}>
      {[HOME, PLAY, DAILY, SOCIAL, ME].map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.match(path) ? "page" : undefined}>
          <span className="bottom-nav-icon">
            <Icon name={item.icon} size={22} />
            {item === SOCIAL && waiting > 0 && <i className="badge">{waiting > 9 ? "9+" : waiting}</i>}
          </span>
          {t(item.label)}
        </Link>
      ))}
    </nav>
  );
}
