"use client";

import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { CHALLENGE_GAMES } from "@/games/registry";
import { useShellT } from "@/lib/shell-messages";

/** A shared day of the dailies: its card, and the way in to today's. */
export function RecapView({ query }: { query: string | null }) {
  const t = useShellT();
  return (
    <section className="recap" aria-labelledby="recap-heading">
      <h1 id="recap-heading" className="section-heading">
        {query ? t("recapTitle") : t("recapMissing")}
      </h1>
      {query && (
        // The card is a picture drawn on the server; it carries the words itself.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="recap-card" src={`/daily/card?${query}`} width={1200} height={630} alt={t("recapAlt")} />
      )}
      <p className="section-lead">{t("recapLead", { n: CHALLENGE_GAMES.length })}</p>
      <div className="recap-actions">
        <ButtonLink href="/daily" variant="play" size="lg" icon={<Icon name="play" size={18} />}>
          {t("recapPlay")}
        </ButtonLink>
        <ButtonLink href="/play" variant="secondary" size="lg">
          {t("browseAll")}
        </ButtonLink>
      </div>
    </section>
  );
}
