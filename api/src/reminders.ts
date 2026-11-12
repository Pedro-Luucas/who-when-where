import type { DatabaseSync } from "node:sqlite";
import { streakOf, utcDay } from "./days.ts";
import type { Pusher } from "./push.ts";
import { inChallengeSql } from "./validate.ts";

// "Your streak ends in 2 hours": once a day, after 22:00 UTC, every player who
// turned notifications on, has a streak going and has not played a daily
// today gets one reminder. The server calls this every few minutes.

/** The UTC hour from which reminders go out (the day ends at 24:00). */
export const REMIND_FROM_HOUR = 22;

export async function remindStreaks(db: DatabaseSync, pusher: Pusher, now = Date.now()): Promise<number> {
  if (!pusher.publicKey || new Date(now).getUTCHours() < REMIND_FROM_HOUR) return 0;
  const today = utcDay(now);
  const players = db
    .prepare(
      `SELECT DISTINCT u.id, u.locale FROM users u JOIN push_subscriptions p ON p.user_id = u.id
        WHERE u.reminded_day < ?`,
    )
    .all(today) as { id: string; locale: string }[];

  let sent = 0;
  for (const player of players) {
    // Asked once a day, whatever the answer.
    db.prepare("UPDATE users SET reminded_day = ? WHERE id = ?").run(today, player.id);
    const days = (
      db.prepare(`SELECT DISTINCT day FROM results WHERE user_id = ? AND ${inChallengeSql()}`).all(player.id) as { day: number }[]
    ).map((row) => row.day);
    const { streak, playedToday } = streakOf(days, today);
    if (streak < 1 || playedToday) continue;
    const pt = player.locale === "pt";
    await pusher.toUser(player.id, {
      title: pt ? `Sua sequência de ${streak} dias está em risco` : `Your ${streak}-day streak is at risk`,
      body: pt ? "Faltam 2 horas para os desafios de hoje acabarem. Jogue um!" : "Today's dailies end in 2 hours. Play one to keep it going!",
      url: "/daily",
      tag: "streak",
    });
    sent++;
  }
  return sent;
}
