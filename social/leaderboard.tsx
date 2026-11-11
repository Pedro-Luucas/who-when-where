"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/account/state";
import { BrowserOnly, Segmented } from "@/components/controls";
import { GAME_SLUGS, GAME_TITLES, type GameSlug } from "@/games/registry";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { Player } from "./avatar";
import { getLeaderboard, type Period, type Scope } from "./client";
import { socialError, useSocialT } from "./messages";
import { useRemote } from "./remote";
import { SocialTabs } from "./tabs";

const EVERY_MS = 30_000;
const PERIODS: Period[] = ["day", "week", "all"];

/** The leaderboards: open to everyone; signing in adds the friends board and the viewer's own place. */
export function Leaderboard() {
  return (
    <BrowserOnly>
      <Board />
    </BrowserOnly>
  );
}

function Board() {
  const { locale, t } = useSocialT();
  const day = useDayNumber();
  const account = useAccount();
  const me = account.status === "user" ? account.account : null;
  const [period, setPeriod] = useState<Period>("day");
  const [scope, setScope] = useState<Scope>("all");
  const [game, setGame] = useState<GameSlug | "all">("all");

  // The friends board needs a session; visitors always see everyone.
  const shownScope = me ? scope : "all";
  const board = useRemote(
    `board:${day}:${period}:${shownScope}:${game}:${me?.id ?? ""}`,
    () => getLeaderboard({ day, period, scope: shownScope, game }),
    EVERY_MS,
  );
  const rows = board.data?.rows;
  const mine = board.data?.me;
  const listed = !!me && !!rows?.some((row) => row.user.id === me.id);

  return (
    <main className="page page-narrow">
      <SocialTabs current="leaderboard" />
      <header className="page-head">
        <h1>{t("leaderboard")}</h1>
        <p>{t("leaderboardLead")}</p>
      </header>

      <div className="filters">
        <Segmented
          label={t("period")}
          options={PERIODS.map((value) => ({ value, label: t(`period_${value}`) }))}
          value={period}
          onChange={setPeriod}
        />
        {me && (
          <Segmented
            label={t("scope")}
            options={[
              { value: "all" as Scope, label: t("scope_all") },
              { value: "friends" as Scope, label: t("scope_friends") },
            ]}
            value={scope}
            onChange={setScope}
          />
        )}
        <label className="select">
          <span className="eyebrow">{t("game")}</span>
          <select value={game} onChange={(event) => setGame(event.target.value as GameSlug | "all")}>
            <option value="all">{t("allGames")}</option>
            {GAME_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {GAME_TITLES[slug]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className="board" aria-busy={!rows}>
        {rows?.map((row) => (
          <li key={row.user.id} data-rank={row.rank <= 3 ? row.rank : undefined} data-me={row.user.id === me?.id ? "" : undefined}>
            <span className="board-rank">{row.rank}</span>
            <Player user={row.user} note={t("puzzleCount", { n: row.puzzles })} />
            <strong className="board-points">{formatNumber(row.points, locale)}</strong>
          </li>
        ))}
        {rows?.length === 0 && <li className="board-empty">{t(shownScope === "friends" ? "boardEmptyFriends" : "boardEmpty")}</li>}
        {!rows && !board.error && <li className="board-empty">…</li>}
        {board.error && !rows && <li className="form-error">{t(socialError(board.error))}</li>}
      </ol>

      {board.data && (
        <p className="hint board-foot">
          {t("boardPlayers", { n: board.data.players })}
          {mine && !listed && ` · ${t("boardYou", { rank: mine.rank, points: formatNumber(mine.points, locale) })}`}
          {me && !mine && ` · ${t("boardNotYet")}`}
        </p>
      )}
      {!me && account.status !== "loading" && (
        <p className="hint board-foot">
          {t("boardGuest")} <Link href="/account?next=/leaderboard">{t("joinAction")}</Link>
        </p>
      )}
      {me && !me.username && (
        <p className="hint board-foot">
          {t("boardNoUsername")} <Link href="/community">{t("pickUsernameAction")}</Link>
        </p>
      )}
    </main>
  );
}
