import { formatNumber, type Locale } from "@/lib/i18n";
import { ROUND_MAX, ROUNDS, TOTAL_MAX, totalScore, type Guess } from "./rules";

const SQUARES = 5;

function meter(score: number): string {
  const filled = Math.round((score / ROUND_MAX) * SQUARES);
  return "🟩".repeat(filled) + "⬜".repeat(SQUARES - filled);
}

/** The spoiler-free result players paste into chats. */
export function shareText(day: number, guesses: Guess[], locale: Locale, url: string): string {
  const lines = ROUNDS.map((round, i) => {
    const guess = guesses[i];
    const icon = (round.event === "birth" ? "🌱" : "🥀") + (round.kind === "place" ? "📍" : "📅");
    const detail = guess.skipped
      ? "—"
      : guess.kind === "place"
        ? `${formatNumber(guess.km, locale)} km`
        : `±${guess.diff}`;
    return `${icon} ${meter(guess.score)} ${detail}`;
  });
  return [
    `Who When Where #${day} · ${totalScore(guesses)}/${TOTAL_MAX}`,
    ...lines,
    url,
  ].join("\n");
}
