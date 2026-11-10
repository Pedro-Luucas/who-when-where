import { MAX_ATTEMPTS, isSolved, type Attempt } from "./rules";

/** The spoiler-free result players paste into chats: one row per attempt. */
export function shareText(day: number, attempts: Attempt[], truth: string[], url: string): string {
  const score = isSolved(attempts, truth) ? attempts.length : "X";
  const rows = attempts.map((attempt) =>
    attempt.map((id, i) => (id === truth[i] ? "🟩" : "🟥")).join(""),
  );
  return [`First to Last #${day} · ${score}/${MAX_ATTEMPTS}`, ...rows, url].join("\n");
}
