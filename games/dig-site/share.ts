import { MAX_DIGS, heatOf, isFound, type Dig } from "./rules";

// Found, then from scorching to freezing.
const SQUARES = ["✅", "🟥", "🟧", "🟨", "⬜", "🟦"];

/** The spoiler-free result players paste into chats. */
export function shareText(day: number, digs: Dig[], url: string): string {
  const score = isFound(digs) ? digs.length : "X";
  const trail = digs.map((dig) => SQUARES[heatOf(dig.km)]).join("");
  return [`Dig Site #${day} · ${score}/${MAX_DIGS}`, `⛏️ ${trail}`, url].join("\n");
}
