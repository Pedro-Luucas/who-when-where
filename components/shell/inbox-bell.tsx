"use client";

import Link from "next/link";
import { useAccount } from "@/account/state";
import { useHubT } from "@/social/hub-messages";
import { pulseCount, usePulse } from "@/social/pulse";
import { Icon } from "./nav-items";

/** The header's bell, for members: the inbox, with what is waiting in it. Hidden on phones (the bottom bar has it). */
export function InboxBell() {
  const account = useAccount();
  const waiting = pulseCount(usePulse());
  const { t } = useHubT();
  if (account.status !== "user") return null;
  const label = waiting > 0 ? t("bellWaiting", { n: waiting }) : t("bell");
  return (
    <Link href="/inbox" className="language-chip inbox-bell" aria-label={label} title={label}>
      <Icon name="bell" size={17} />
      {waiting > 0 && <i className="badge">{waiting > 9 ? "9+" : waiting}</i>}
    </Link>
  );
}
