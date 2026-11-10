"use client";

import { HubStatus } from "@/components/hub-status";
import { MAX_GUESSES, isOver, isSolved } from "./rules";
import { useSave } from "./store";

/** Hub card footer: how the player stands on today's journey. */
export function WayfarerStatus() {
  const [save] = useSave();
  return (
    <HubStatus
      progress={(day) => {
        const record = save.days[day];
        if (record && isOver(record.journeyId, record.guesses)) {
          const solved = isSolved(record.journeyId, record.guesses);
          return { result: `${solved ? record.guesses.length : "X"}/${MAX_GUESSES}` };
        }
        return { started: !!record?.guesses.length };
      }}
    />
  );
}
