"use client";

import { Suspense, use } from "react";
import { browser } from "react-dom";
import { useDayNumber } from "@/lib/clock";
import { formatNumber, useLocale, useSiteT } from "@/lib/i18n";
import { TOTAL_MAX, totalScore } from "./rules";
import { isComplete, useSave } from "./store";

/** Hub card footer: today's puzzle number and how the player stands. */
export function WhoWhenWhereStatus() {
  return (
    <Suspense fallback={<span>&nbsp;</span>}>
      <Status />
    </Suspense>
  );
}

function Status() {
  use(browser("Today's progress depends on the player's local date and saved games."));
  const day = useDayNumber();
  const [save] = useSave();
  const locale = useLocale();
  const t = useSiteT();
  const record = save.days[day];

  if (isComplete(record)) {
    return (
      <>
        <span>
          #{day} · {formatNumber(totalScore(record.guesses), locale)}/{formatNumber(TOTAL_MAX, locale)}
        </span>
        <strong>{t("seeResult")} →</strong>
      </>
    );
  }
  const started = !!record?.guesses.length;
  return (
    <>
      <span>
        #{day} · {t(started ? "inProgress" : "notPlayed")}
      </span>
      <strong>{t(started ? "continue" : "play")} →</strong>
    </>
  );
}
