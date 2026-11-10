import { countryById } from "@/lib/countries";
import { MAX_GUESSES, isSolved, readingOf } from "./rules";

// From scorching to freezing, then the way to go.
const SQUARES = ["✅", "🟥", "🟧", "🟨", "⬜", "🟦"];
const ARROWS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];

/** The spoiler-free result players paste into chats. */
export function shareText(day: number, targetId: string, guesses: string[], url: string): string {
  const target = countryById(targetId);
  const score = isSolved(targetId, guesses) ? guesses.length : "X";
  const trail = guesses.map((id) => {
    const reading = target && readingOf(target, id);
    if (!reading) return "";
    return reading.hit ? SQUARES[0] : `${SQUARES[reading.heat]}${ARROWS[reading.direction]}`;
  });
  return [`Outline #${day} · ${score}/${MAX_GUESSES}`, `🗺️ ${trail.join(" ")}`, url].join("\n");
}
