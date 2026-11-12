import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/shell/nav-items";
import { SiteText } from "@/components/site-text";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/**
 * An address that leads nowhere (a mistyped link, a game that never existed):
 * the site's own shell, in the player's theme and language, with the two ways
 * back — the catalogue and the home page — as full-size keys.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page page-narrow">
        <section className="notice not-found">
          <p className="eyebrow">404</p>
          <h1>
            <SiteText k="notFoundTitle" />
          </h1>
          <p>
            <SiteText k="notFoundLead" />
          </p>
          <div className="page-actions">
            <ButtonLink href="/play" variant="play" icon={<Icon name="play" size={17} />}>
              <SiteText k="notFoundPlay" />
            </ButtonLink>
            <ButtonLink href="/" variant="secondary">
              <SiteText k="errorHome" />
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
