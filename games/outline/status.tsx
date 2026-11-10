"use client";

import { HubStatus } from "@/components/hub-status";
import { MAX_GUESSES, isOver, isSolved } from "./rules";
import { useSave } from "./store";

/** Hub card footer: how the player stands on today's country. */
export function OutlineStatus() {
  const [save] = useSave();
  return (
    <HubStatus
      progress={(day) => {
        const record = save.days[day];
        const guesses = record?.guesses ?? [];
        if (record && isOver(record.countryId, guesses)) {
          return { result: `${isSolved(record.countryId, guesses) ? guesses.length : "X"}/${MAX_GUESSES}` };
        }
        return { started: guesses.length > 0 };
      }}
    />
  );
}
