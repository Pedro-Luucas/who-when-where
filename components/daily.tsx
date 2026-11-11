"use client";

import { Suspense, use } from "react";
import { browser } from "react-dom";
import { useDayNumber } from "@/lib/clock";

/**
 * Renders today's puzzle. The puzzle number comes from the player's own
 * clock, so this part of the page only exists in the browser:
 *
 *   <Daily>{(day) => <Play key={day} day={day} />}</Daily>
 *
 * Key the game by `day` so the next puzzle starts clean at midnight. Every
 * game's daily page is built this way, in games/platform/board.tsx.
 */
export function Daily({ children }: { children: (day: number) => React.ReactNode }) {
  return (
    <Suspense fallback={<GameSkeleton />}>
      <Today>{children}</Today>
    </Suspense>
  );
}

function Today({ children }: { children: (day: number) => React.ReactNode }) {
  use(browser("The daily puzzle depends on the player's local date and saved progress."));
  return children(useDayNumber());
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
