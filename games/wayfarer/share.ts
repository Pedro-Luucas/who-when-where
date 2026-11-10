import { MAX_GUESSES, isSolved, type Guess } from "./rules";

/** The spoiler-free result players paste into chats. */
export function shareText(day: number, journeyId: string, guesses: Guess[], url: string): string {
  const score = isSolved(journeyId, guesses) ? guesses.length : "X";
  const trail = guesses
    .map((guess) => (guess === journeyId ? "🟩" : guess === null ? "⬛" : "🟥"))
    .join("");
  return [`Wayfarer #${day} · ${score}/${MAX_GUESSES}`, `🧭 ${trail}`, url].join("\n");
}
