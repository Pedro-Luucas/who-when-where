"use client";

import { HubStatus } from "@/components/hub-status";
import { MAX_ATTEMPTS, isOver, isSolved, truthOf } from "./rules";
import { puzzleOf, useSave } from "./store";

/** Hub card footer: how the player stands on today's six events. */
export function FirstToLastStatus() {
  const [save] = useSave();
  return (
    <HubStatus
      progress={(day) => {
        const { events, attempts } = puzzleOf(save, day);
        const truth = truthOf(events);
        if (isOver(attempts, truth)) {
          return { result: `${isSolved(attempts, truth) ? attempts.length : "X"}/${MAX_ATTEMPTS}` };
        }
        return { started: attempts.length > 0 };
      }}
    />
  );
}
