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
export function Daily({
  children,
  skeleton = "map",
}: {
  children: (day: number, archive: boolean) => React.ReactNode;
  /** The game's shape while it loads (skeletonShapeOf). */
  skeleton?: SkeletonShape;
}) {
  return (
    <Suspense fallback={<GameSkeleton shape={skeleton} />}>
      <Today skeleton={skeleton}>{children}</Today>
    </Suspense>
  );
}

/** The archive day `?day=` asks for, if it is one that can be played; otherwise null. */
export function archiveDayOf(value: string | null, today: number): number | null {
  const day = Number(value);
  if (!value || !Number.isInteger(day) || !today) return null;
  return day >= 1 && day < today && day >= today - ARCHIVE_DAYS ? day : null;
}

function Today({
  children,
  skeleton,
}: {
  children: (day: number, archive: boolean) => React.ReactNode;
  skeleton: SkeletonShape;
}) {
  use(browser("The daily puzzle depends on the day by the clock and on saved progress."));
  const today = useDayNumber();
  const archived = archiveDayOf(useSearchParams().get("day"), today);
  const entitlements = useEntitlements();
  const allowed = archiveWindow(entitlements);
  if (archived && allowed !== null) {
    // With the plans switch on, only the last few days are free (shared/plans.ts).
    if (entitlements.loading) return <GameSkeleton shape={skeleton} />;
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

/** The shape of a game's board while it loads: a map, answer cards, a list, or a picture. */
export type SkeletonShape = "map" | "cards" | "list" | "photo";

const SHAPES: Partial<Record<string, SkeletonShape>> = {
  "could-they-meet": "cards",
  "earlier-or-later": "cards",
  "higher-or-lower": "cards",
  "true-size": "cards",
  quickplay: "cards",
  gauntlet: "cards",
  "same-year": "list",
  lifelines: "list",
  "clue-ladder": "list",
  timeline: "list",
  "flag-peek": "photo",
  "year-snap": "photo",
};

/** How a game's page looks while it loads (the map, unless the game has none). */
export const skeletonShapeOf = (slug: string): SkeletonShape => SHAPES[slug] ?? "map";

/**
 * What a game's page shows until the game itself is on screen: the HUD, the
 * brief and the board in their places — a map, cards, a list or a picture,
 * in the game's own shape, so nothing jumps when it arrives.
 */
export function GameSkeleton({ shape = "map" }: { shape?: SkeletonShape }) {
  return (
    <main className="game game-skeleton" aria-busy="true" data-shape={shape}>
      <div className="hud skeleton-block" />
      <div className="dossier">
        <div className="skeleton-block skeleton-brief" />
      </div>
      <section className="stage">
        <div className="plaque skeleton-block" />
        {shape === "map" && <div className="map-frame skeleton-block" />}
        {shape === "photo" && <div className="skeleton-block skeleton-photo" />}
        {shape === "cards" && (
          <div className="skeleton-cards">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-block" />
            ))}
          </div>
        )}
        {shape === "list" && (
          <div className="skeleton-list">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-block" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
