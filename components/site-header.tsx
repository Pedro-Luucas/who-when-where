import Link from "next/link";
import { AccountButton } from "@/account/account-button";
import { CommunityButton } from "@/social/tabs";
import { LocaleToggle } from "./locale-toggle";

/** Shared top bar. `children` are page-specific actions (e.g. a game's help button). */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Who When Where — home">
        <span>Who</span>
        <i aria-hidden="true">·</i>
        <span>When</span>
        <i aria-hidden="true">·</i>
        <span>Where</span>
      </Link>
      <nav className="site-actions">
        {children}
        <CommunityButton />
        <AccountButton />
        <LocaleToggle />
      </nav>
    </header>
  );
}
