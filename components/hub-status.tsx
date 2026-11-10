"use client";

import { Suspense, use } from "react";
import { browser } from "react-dom";
import { useDayNumber } from "@/lib/clock";
import { useSiteT } from "@/lib/i18n";

/** A finished puzzle's short result ("750/1,000", "3/6"), or whether it was started. */
export type HubProgress = { result: string } | { started: boolean };

/**
 * A game's line on its hub card: today's puzzle number and how the player
 * stands. `progress` reads the game's own save for the given day.
 */
export function HubStatus({ progress }: { progress: (day: number) => HubProgress }) {
  return (
    <Suspense fallback={<span>&nbsp;</span>}>
      <Status progress={progress} />
    </Suspense>
  );
}

function Status({ progress }: { progress: (day: number) => HubProgress }) {
  use(browser("Today's progress depends on the player's local date and saved games."));
  const day = useDayNumber();
  const t = useSiteT();
  const state = progress(day);

  if ("result" in state) {
    return (
      <>
        <span>
          #{day} · {state.result}
        </span>
        <strong>{t("seeResult")} →</strong>
      </>
    );
  }
  return (
    <>
      <span>
        #{day} · {t(state.started ? "inProgress" : "notPlayed")}
      </span>
      <strong>{t(state.started ? "continue" : "play")} →</strong>
    </>
  );
}
