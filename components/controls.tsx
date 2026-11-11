"use client";

import { Suspense, use } from "react";
import { browser } from "react-dom";

// The choice controls live in the UI kit; re-exported here for the screens that import them from this file.
export { Segmented, Stepper } from "./ui/segmented";

/**
 * Renders its children in the browser only: for pages built from what the
 * visitor's device knows (their session, saved games, the address bar).
 */
export function BrowserOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="page" aria-busy="true">
          <div className="page-skeleton skeleton-block" />
        </main>
      }
    >
      <InBrowser>{children}</InBrowser>
    </Suspense>
  );
}

function InBrowser({ children }: { children: React.ReactNode }) {
  use(browser("This page is built from the visitor's session, saved games and address bar."));
  return children;
}
