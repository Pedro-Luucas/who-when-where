import Link from "next/link";
import { AccountButton } from "@/account/account-button";
import { CommunityButton } from "@/social/tabs";
import { LogbookButton, SettingsButton } from "./settings-button";

/** Shared top bar. `children` are page-specific actions (e.g. a game's help button). */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="site-header">
      {/* On narrow screens with a game's own buttons, the name shrinks to W·W·W. */}
      <Link href="/" className="wordmark" aria-label="Who When Where — home">
        <span>
          W<em>ho</em>
        </span>
        <i aria-hidden="true">·</i>
        <span>
          W<em>hen</em>
        </span>
        <i aria-hidden="true">·</i>
        <span>
          W<em>here</em>
        </span>
      </Link>
      <nav className="site-actions">
        {children}
        <LogbookButton />
        <CommunityButton />
        <AccountButton />
        <SettingsButton />
      </nav>
    </header>
  );
}
