"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, use } from "react";
import { browser } from "react-dom";
import { ARCHIVE_DAYS } from "@/games/daily-set";
import { useDayNumber } from "@/lib/clock";

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
  return archived ? children(archived, true) : children(today, false);
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
