"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/account/state";
import { BrowserOnly, Segmented } from "@/components/controls";
import { GAME_SLUGS, GAME_TITLES, type GameSlug } from "@/games/registry";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { Icon } from "@/components/shell/nav-items";
import { Flag, Player } from "./avatar";
import { useConnectT } from "./connect-messages";
import { getLeaderboard, type Period, type Scope } from "./client";
import { socialError, useSocialT } from "./messages";
import { useRemote } from "./remote";
import { SocialTabs } from "./tabs";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { t: tc } = useConnectT();
  const day = useDayNumber();
  const account = useAccount();
  const me = account.status === "user" ? account.account : null;
  const [period, setPeriod] = useState<Period>("day");
  const [scope, setScope] = useState<Scope>("all");
  const [game, setGame] = useState<GameSlug | "all">("all");

  // The friends board needs a session, and the flag board a flag; visitors always see everyone.
  const country = me?.country ?? null;
  const shownScope = !me || (scope === "country" && !country) ? "all" : scope;
  const board = useRemote(
    `board:${day}:${period}:${shownScope}:${game}:${me?.id ?? ""}:${country ?? ""}`,
    () => getLeaderboard({ day, period, scope: shownScope, game, ...(shownScope === "country" && country ? { country } : {}) }),
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

      <nav className="mb-5 grid gap-3 sm:grid-cols-2" aria-label={tc("boardsMore")}>
        <Link
          href="/league"
          className="flex items-center gap-3 rounded-lg border border-line-strong bg-(image:--panel-fill) p-4 transition-colors hover:border-accent/70"
        >
          <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="medal" size={22} />
          </span>
          <span className="min-w-0">
            <b className="block text-fg">{tc("leagueTitle")}</b>
            <small className="text-fg-2">Bronze → {tc("tier_4")}</small>
          </span>
        </Link>
        <Link
          href="/weekly"
          className="flex items-center gap-3 rounded-lg border border-line-strong bg-(image:--panel-fill) p-4 transition-colors hover:border-accent/70"
        >
          <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="sparkle" size={22} />
          </span>
          <span className="min-w-0">
            <b className="block text-fg">{tc("weekly")}</b>
            <small className="text-fg-2">{tc("weeklyBoard")}</small>
          </span>
        </Link>
      </nav>

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
              ...(country ? [{ value: "country" as Scope, label: tc("scope_country") }] : []),
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
        {rows?.length === 0 && (
          <li className="board-empty">
            {shownScope === "country" ? (
              <>
                <Flag code={country} /> {tc("boardEmptyCountry")}
              </>
            ) : (
              t(shownScope === "friends" ? "boardEmptyFriends" : "boardEmpty")
            )}
          </li>
        )}
        {/* Loading: rows in the board's own shape, so nothing jumps when it arrives. */}
        {!rows &&
          !board.error &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={`loading-${i}`} className="board-loading" aria-hidden="true" style={{ animationDelay: `${i * 70}ms` }}>
              <Skeleton shape="circle" className="size-7" />
              <Skeleton shape="circle" className="size-9" />
              <Skeleton shape="text" className={i % 2 ? "w-2/5" : "w-1/2"} />
              <Skeleton shape="text" className="ml-auto w-14" />
            </li>
          ))}
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
      {me && me.username && !country && me.profileVisibility !== undefined && (
        <p className="hint board-foot">
          {tc("setCountry")} <Link href="/account">{tc("privacy")}</Link>
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
