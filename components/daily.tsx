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
 * Key the game by `day` so the next puzzle starts clean at midnight.
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

function GameSkeleton() {
  return (
    <main className="game game-skeleton" aria-busy="true">
      <div className="dossier">
        <div className="portrait skeleton-block" />
      </div>
      <section className="stage">
        <div className="map-frame skeleton-block" />
      </section>
    </main>
  );
}
