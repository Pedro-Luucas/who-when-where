"use client";

import Link from "next/link";
import { useAccountT } from "./messages";
import { useAccount } from "./state";

/** Header link to /account: an outline for visitors, an initial once signed in. */
export function AccountButton() {
  const state = useAccount();
  const t = useAccountT();
  const account = state.status === "user" ? state.account : null;
  const initial = account ? [...(account.displayName || account.email)][0]?.toUpperCase() : null;
  const label = account ? `${t("title")}: ${account.displayName || account.email}` : t("signIn");

  return (
    <Link
      href="/account"
      className="icon-button"
      data-signed-in={account ? "" : undefined}
      aria-label={label}
      title={label}
    >
      {initial ?? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="5.2" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M2.8 14c.5-2.8 2.6-4.4 5.2-4.4s4.7 1.6 5.2 4.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </Link>
  );
}
