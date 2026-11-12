"use client";

import { useAccount, type Account } from "@/account/state";
import { useShellT } from "@/lib/shell-messages";
import { pulseCount, usePulse } from "@/social/pulse";
import type { IconName } from "./nav-items";

// What the account menu lists, for the header's popover (wide screens) and
// the phone's "Me" sheet (shell/me-sheet.tsx): the same places, in one order.

export type AccountItem = { href: string; label: string; icon: IconName; badge?: number };

export type AccountSummary = {
  account: Account | null;
  guest: boolean;
  /** What to call the player: display name, username, e-mail, or "Guest". */
  name: string;
  /** The line under the name: @username, the e-mail, or a note for guests. */
  note: string;
  /** Things waiting: requests, invitations, unread messages. */
  waiting: number;
  items: AccountItem[];
};

export function useAccountItems(): AccountSummary {
  const t = useShellT();
  const state = useAccount();
  const account = state.status === "user" ? state.account : null;
  const waiting = pulseCount(usePulse());
  const name = account ? account.displayName || account.username || account.email : t("guest");
  const items: AccountItem[] = [
    ...(account?.username
      ? [{ href: `/u/${encodeURIComponent(account.username)}`, label: t("profile"), icon: "user" as const }]
      : []),
    ...(account ? [{ href: "/inbox", label: t("navInbox"), icon: "bell" as const, badge: waiting }] : []),
    { href: "/account", label: account ? t("account") : t("signIn"), icon: account ? "sliders" : "user" },
    { href: "/logbook", label: t("logbook"), icon: "book" },
    { href: "/expedition", label: t("expedition"), icon: "compass" },
    { href: "/community", label: t("navCommunity"), icon: "people" },
    { href: "/league", label: t("navLeague"), icon: "medal" },
    { href: "/weekly", label: t("navWeekly"), icon: "sparkle" },
    { href: "/leaderboard", label: t("navLeaderboard"), icon: "trophy" },
    { href: "/pricing", label: t("navPricing"), icon: "crown" },
  ];
  return {
    account,
    guest: state.status === "guest",
    name,
    note: account ? (account.username ? `@${account.username}` : account.email) : t("guestNote"),
    waiting,
    items,
  };
}
