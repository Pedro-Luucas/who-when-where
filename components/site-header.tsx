import { Suspense } from "react";
import { AccountMenu } from "./shell/account-menu";
import { LanguageChip } from "./shell/language-chip";
import { Logo } from "./shell/logo";
import { MainNav } from "./shell/main-nav";
import { SearchButton } from "./shell/search";

/**
 * The shared top bar: the logo, the main places as pills (Play, Daily,
 * Leaderboard, Community, Party), search ("/"), the language chip and the
 * account menu. On phones the pills move to the bottom bar (shell/bottom-nav).
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Logo />
      <MainNav />
      <div className="site-actions">
        <SearchButton />
        <LanguageChip />
        {/* The menu follows the address; an unknown game's address is only known on request. */}
        <Suspense fallback={<span className="account-button" aria-hidden="true" />}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );
}
