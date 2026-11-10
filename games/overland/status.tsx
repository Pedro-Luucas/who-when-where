"use client";

import { HubStatus } from "@/components/hub-status";
import { isOver, isSolved, maxGuesses } from "./rules";
import { puzzleOf, useSave } from "./store";

/** Hub card footer: how the player stands on today's crossing. */
export function OverlandStatus() {
  const [save] = useSave();
  return (
    <HubStatus
      progress={(day) => {
        const { puzzle, guesses } = puzzleOf(save, day);
        if (isOver(puzzle, guesses)) {
          return { result: `${isSolved(puzzle, guesses) ? guesses.length : "X"}/${maxGuesses(puzzle)}` };
        }
        return { started: guesses.length > 0 };
      }}
    />
  );
}
