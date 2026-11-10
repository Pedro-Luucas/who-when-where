"use client";

import { HubStatus } from "@/components/hub-status";
import { MAX_DIGS, isFound, isOver } from "./rules";
import { useSave } from "./store";

/** Hub card footer: how the player stands on today's dig. */
export function DigSiteStatus() {
  const [save] = useSave();
  return (
    <HubStatus
      progress={(day) => {
        const digs = save.days[day]?.digs ?? [];
        if (isOver(digs)) return { result: `${isFound(digs) ? digs.length : "X"}/${MAX_DIGS}` };
        return { started: digs.length > 0 };
      }}
    />
  );
}
