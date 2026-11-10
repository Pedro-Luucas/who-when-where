"use client";

import { useSiteT } from "@/lib/i18n";
import { openPanel } from "@/lib/ui";

/** Header buttons every game gets: how to play, and statistics. */
export function GameActions() {
  const t = useSiteT();
  return (
    <>
      <button
        type="button"
        className="icon-button"
        onClick={() => openPanel("help")}
        aria-label={t("help")}
        title={t("help")}
      >
        ?
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => openPanel("stats")}
        aria-label={t("stats")}
        title={t("stats")}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2.5 13.5v-4M8 13.5v-11M13.5 13.5v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}
