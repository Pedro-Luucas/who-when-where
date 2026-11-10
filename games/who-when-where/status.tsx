"use client";

import { HubStatus } from "@/components/hub-status";
import { formatNumber, useLocale } from "@/lib/i18n";
import { TOTAL_MAX, totalScore } from "./rules";
import { isComplete, useSave } from "./store";

/** Hub card footer: how the player stands on today's person. */
export function WhoWhenWhereStatus() {
  const [save] = useSave();
  const locale = useLocale();
  return (
    <HubStatus
      progress={(day) => {
        const record = save.days[day];
        if (isComplete(record)) {
          const score = formatNumber(totalScore(record.guesses), locale);
          return { result: `${score}/${formatNumber(TOTAL_MAX, locale)}` };
        }
        return { started: !!record?.guesses.length };
      }}
    />
  );
}
