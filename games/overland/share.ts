import { isSolved, maxGuesses, verdictOf, type Puzzle } from "./rules";

const SQUARES = { on: "🟩", near: "🟨", off: "⬛" };

/** The spoiler-free result players paste into chats. */
export function shareText(day: number, puzzle: Puzzle, guesses: string[], url: string): string {
  const score = isSolved(puzzle, guesses) ? guesses.length : "X";
  const trail = guesses.map((id) => SQUARES[verdictOf(puzzle, id)]).join("");
  return [`Overland #${day} · ${score}/${maxGuesses(puzzle)}`, `🧭 ${trail}`, url].join("\n");
}
