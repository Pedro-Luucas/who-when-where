"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, use } from "react";
import { browser } from "react-dom";
import { archiveWindow, useEntitlements } from "@/account/entitlements";
import { ProTeaser } from "@/components/pro/gate";
import { useProT } from "@/components/pro/messages";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { ARCHIVE_DAYS } from "@/games/daily-set";
import { useDayNumber } from "@/lib/clock";
import { LIMITS } from "@/shared/plans";

/**
 * Renders today's puzzle — or, from the archive (`?day=N`, a past day no
 * older than ARCHIVE_DAYS), that day's. The puzzle number comes from the
 * clock (lib/clock.ts), so this part of the page only exists in the browser:
 *
 *   <Daily>{(day, archive) => <Play key={day} day={day} archive={archive} />}</Daily>
 *
 * Key the game by `day` so the next puzzle starts clean at midnight. Every
 * game's daily page is built this way, in games/platform/board.tsx.
 */
export function Daily({ children }: { children: (day: number, archive: boolean) => React.ReactNode }) {
  return (
    <Suspense fallback={<GameSkeleton />}>
      <Today>{children}</Today>
    </Suspense>
  );
}

/** The archive day `?day=` asks for, if it is one that can be played; otherwise null. */
export function archiveDayOf(value: string | null, today: number): number | null {
  const day = Number(value);
  if (!value || !Number.isInteger(day) || !today) return null;
  return day >= 1 && day < today && day >= today - ARCHIVE_DAYS ? day : null;
}

function Today({ children }: { children: (day: number, archive: boolean) => React.ReactNode }) {
  use(browser("The daily puzzle depends on the day by the clock and on saved progress."));
  const today = useDayNumber();
  const archived = archiveDayOf(useSearchParams().get("day"), today);
  const entitlements = useEntitlements();
  const allowed = archiveWindow(entitlements);
  if (archived && allowed !== null) {
    // With the plans switch on, only the last few days are free (shared/plans.ts).
    if (entitlements.loading) return <GameSkeleton />;
    if (today - archived > allowed) return <ArchiveLocked allowed={allowed} guest={entitlements.plan === "guest"} />;
  }
  return archived ? children(archived, true) : children(today, false);
}

/** In place of an archive puzzle outside the player's plan. */
function ArchiveLocked({ allowed, guest }: { allowed: number; guest: boolean }) {
  const t = useProT();
  return (
    <main className="shell-page pro-gate-page">
      <ProTeaser
        feature="archive.all"
        title={t("archiveTitle")}
        body={guest ? t("archiveBodyGuest", { n: LIMITS.free.archiveDays ?? 0 }) : t("archiveBodyFree", { n: allowed })}
        actions={
          <ButtonLink href="/daily" variant="secondary" icon={<Icon name="calendar" size={17} />}>
            {t("backToDailies")}
          </ButtonLink>
        }
      />
    </main>
  );
}

/** What a game's page shows until the game itself is on screen: the HUD, the brief and the map, in their places. */
export function GameSkeleton() {
  return (
    <main className="game game-skeleton" aria-busy="true">
      <div className="hud skeleton-block" />
      <div className="dossier">
        <div className="skeleton-block skeleton-brief" />
      </div>
      <section className="stage">
        <div className="plaque skeleton-block" />
        <div className="map-frame skeleton-block" />
      </section>
    </main>
  );
}
