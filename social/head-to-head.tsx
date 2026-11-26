"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { GAME_TITLES, isGameSlug } from "@/games/registry";
import { formatNumber } from "@/lib/i18n";
import { getProfile, type Profile } from "./client";
import { useHubT } from "./hub-messages";
import { useRemote } from "./remote";

/**
 * On someone else's profile: the viewer against them. Days both played (who
 * scored more that day) and the average in every game both have played.
 * Built from the two public profiles; nothing new is asked of the server.
 */
export function HeadToHead({ them, mine }: { them: Profile; mine: string }) {
  const { t, locale } = useHubT();
  const own = useRemote(`h2h:${mine}`, () => getProfile(mine));
  const me = own.data;
  if (!me || me.private || !me.stats) return null;

  const theirDays = new Map(them.activity.map((entry) => [entry.day, entry.points]));
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const entry of me.activity) {
    const other = theirDays.get(entry.day);
    if (other === undefined || entry.puzzles === 0) continue;
    if (entry.points > other) wins++;
    else if (entry.points < other) losses++;
    else ties++;
  }
  const shared = wins + losses + ties;

  const theirGames = new Map((them.games ?? []).map((entry) => [entry.game, entry]));
  const games = (me.games ?? [])
    .filter((entry) => isGameSlug(entry.game) && entry.played > 0 && (theirGames.get(entry.game)?.played ?? 0) > 0)
    .map((entry) => {
      const other = theirGames.get(entry.game)!;
      return { game: entry.game, mine: Math.round(entry.points / entry.played), theirs: Math.round(other.points / other.played) };
    })
    .sort((a, b) => b.mine + b.theirs - (a.mine + a.theirs))
    .slice(0, 6);

  const firstName = them.user.name.split(" ")[0];

  return (
    <Card className="mb-5 h2h">
      <CardHeader eyebrow={t("h2hLead")} title={t("h2hTitle", { name: firstName })} level={2} />
      {shared === 0 ? (
        <p className="hub-empty">{t("h2hNone")}</p>
      ) : (
        <>
          <div className="h2h-score" role="group" aria-label={t("h2hDays")}>
            <span data-side="me">
              <b>{wins}</b>
              <small>{t("h2hWins")}</small>
            </span>
            <span>
              <b>{ties}</b>
              <small>{t("h2hTies")}</small>
            </span>
            <span data-side="them">
              <b>{losses}</b>
              <small>{t("h2hLosses")}</small>
            </span>
          </div>
          <div className="h2h-split" aria-hidden="true">
            <i style={{ flexGrow: wins || 0.0001 }} data-side="me" />
            <i style={{ flexGrow: ties || 0.0001 }} />
            <i style={{ flexGrow: losses || 0.0001 }} data-side="them" />
          </div>
          <p className="h2h-days">
            {t("h2hDays")}: <b>{shared}</b>
          </p>
        </>
      )}
      {games.length > 0 && (
        <ul className="h2h-games">
          {games.map((row) => {
            const top = Math.max(row.mine, row.theirs, 1);
            return (
              <li key={row.game}>
                <span className="h2h-game">{GAME_TITLES[row.game]}</span>
                <span className="h2h-bars">
                  <span data-side="me" data-ahead={row.mine > row.theirs ? "" : undefined}>
                    <i style={{ width: `${(row.mine / top) * 100}%` }} />
                    <b>
                      {t("h2hYou")} · {formatNumber(row.mine, locale)}
                    </b>
                  </span>
                  <span data-side="them" data-ahead={row.theirs > row.mine ? "" : undefined}>
                    <i style={{ width: `${(row.theirs / top) * 100}%` }} />
                    <b>
                      {firstName} · {formatNumber(row.theirs, locale)}
                    </b>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
