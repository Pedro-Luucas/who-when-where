"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/account/state";
import { BrowserOnly } from "@/components/controls";
import { Icon } from "@/components/shell/nav-items";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FamilyIcon } from "@/components/ui/family-icon";
import { isRunOver, newRun, runMax, runTotal, type Run } from "@/expedition/run";
import { ApiError } from "@/account/api";
import { Runner } from "@/expedition/runner";
import { stageCount } from "@/expedition/settings";
import { useSettingsLine } from "@/expedition/setup";
import { usePreloadedGames } from "@/expedition/stages";
import { useDayNumber } from "@/lib/clock";
import { formatNumber } from "@/lib/i18n";
import { timeLeft, useMinute, weekEndsAt, weekOfDay } from "@/lib/weeks";
import { Player } from "./avatar";
import { createChallenge, getWeeklyBoard, putWeekly } from "./connect";
import { isMissingFeature, useConnectT } from "./connect-messages";
import { useSocialT } from "./messages";
import { useRemote } from "./remote";
import { RunGames, runSquares } from "./run-parts";
import { ShareKey } from "./share-key";
import { SocialTabs } from "./tabs";
import { themeOfWeek, useWeeklyRun, weeklySeed, weeklySettings, type WeeklyStored as Stored } from "./weekly-special";

// /weekly: the Weekly Special. One longer run a week, the same puzzles for
// everybody (dealt from the week number), one try each. The run is kept on the
// device; signed-in players' scores go to the week's board.


export function WeeklyPage() {
  return (
    <BrowserOnly>
      <Weekly />
    </BrowserOnly>
  );
}

function Weekly() {
  const day = useDayNumber();
  const week = weekOfDay(day);
  const [stored, setStored] = useWeeklyRun(week);
  const run = stored.run;
  usePreloadedGames(run ? null : weeklySettings(week));
  const { t: ts } = useSocialT();
  const account = useAccount();
  const member = account.status === "user" && !!account.account.username;
  const [saving, setSaving] = useState<"idle" | "saving" | "failed">("idle");

  /** Sends a finished run to the week's board (signed-in players only). */
  async function send(done: Run) {
    if (!member) return;
    setSaving("saving");
    try {
      await putWeekly(week, done.results.map(({ points, detail }) => ({ points, detail })));
      setStored((previous) => ({ ...previous, sent: true }));
      setSaving("idle");
    } catch (error) {
      // A week that ended mid-run, or an API from before the Special: nothing to retry.
      const final = error instanceof ApiError && (error.code === "week_over" || isMissingFeature(error));
      setSaving(final ? "idle" : "failed");
      if (final) setStored((previous) => ({ ...previous, sent: true }));
    }
  }

  if (day < 1) return <main className="page" aria-busy="true" />;
  if (run && !isRunOver(run)) {
    return (
      <Runner
        run={run}
        onChange={(next) => setStored((previous) => ({ ...previous, run: next }))}
        onFinish={(next) => {
          setStored((previous) => ({ ...previous, run: next }));
          void send(next);
        }}
        aside={
          <button
            type="button"
            className="run-quit"
            onClick={() => {
              if (window.confirm(ts("quitConfirm"))) setStored((previous) => ({ ...previous, run: null }));
            }}
          >
            {ts("quit")}
          </button>
        }
      />
    );
  }
  return (
    <WeeklyHome
      week={week}
      stored={stored}
      onStart={() => setStored({ week, run: newRun(`weekly:${week}`, weeklySeed(week), weeklySettings(week)), sent: false })}
      saving={saving}
      onSend={(done) => void send(done)}
      onChallenge={(challenge) => setStored((previous) => ({ ...previous, challenge }))}
    />
  );
}

type HomeProps = {
  week: number;
  stored: Stored;
  onStart: () => void;
  saving: "idle" | "saving" | "failed";
  onSend: (run: Run) => void;
  onChallenge: (id: string) => void;
};

function WeeklyHome({ week, stored, onStart, saving, onSend, onChallenge }: HomeProps) {
  const { t: ts } = useSocialT();
  const { locale, t } = useConnectT();
  const settingsLine = useSettingsLine();
  const account = useAccount();
  const me = account.status === "user" ? account.account : null;
  const member = !!me?.username;
  const now = useMinute();
  const theme = themeOfWeek(week);
  const settings = weeklySettings(week);
  const max = runMax(settings);
  const board = useRemote(account.status === "loading" ? null : `weekly:${week}:${me?.id ?? ""}`, () => getWeeklyBoard(week), 60_000);
  const done = stored.run && isRunOver(stored.run) ? stored.run : null;
  const total = done ? runTotal(done.results) : null;
  const shareText = async () => {
    // A Special doubles as a challenge: friends get the same puzzles on /c/<id>.
    let link = `${window.location.origin}/weekly`;
    if (stored.challenge) link = `${window.location.origin}/c/${stored.challenge}`;
    else if (member && done) {
      try {
        const made = await createChallenge({
          seed: done.seed,
          settings,
          results: done.results.map(({ points, detail }) => ({ points, detail })),
        });
        onChallenge(made.id);
        link = `${window.location.origin}/c/${made.id}`;
      } catch {
        // the Special's own page is the next best thing
      }
    }
    return `Who When Where · ${t("weekly")} #${week} · ${theme.title[locale]}\n${formatNumber(total ?? 0, locale)}/${formatNumber(max, locale)} ${runSquares(done?.results ?? [])}\n${link}`;
  };

  return (
    <main className="page">
      <SocialTabs current="weekly" />
      <header className="page-head">
        <p className="eyebrow">
          {t("weekNo", { n: week })} · {t("endsIn", { time: now ? timeLeft(weekEndsAt(week), now) : "…" })}
        </p>
        <h1>{t("weekly")}</h1>
        <p>{t("weeklyLead")}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rise-in" family={theme.family}>
          <div className="flex flex-wrap items-start gap-4">
            <span
              className="grid size-16 shrink-0 place-items-center rounded-lg bg-(--fam)/15 text-(--fam) [&>svg]:size-9"
              style={{ "--fam": `var(--color-family-${theme.family})` } as React.CSSProperties}
            >
              <FamilyIcon family={theme.family} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{t("weeklyTheme", { title: "" }).replace(/[:：]\s*$/, "")}</p>
              <h2 className="font-display text-3xl font-bold text-fg">{theme.title[locale]}</h2>
              <p className="mt-1 text-fg-2">{theme.blurb[locale]}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <p className="eyebrow">{t("weeklyGames")}</p>
            <RunGames settings={settings} />
            <p className="font-mono text-xs text-fg-2">{settingsLine(settings)}</p>
          </div>

          {done ? (
            <div className="mt-5 rounded-md border border-line-strong bg-sunken/60 p-4">
              <p className="eyebrow">{t("weeklyYourScore")}</p>
              <p className="font-mono text-4xl font-bold text-fg tabular-nums">
                {formatNumber(total ?? 0, locale)} <span className="text-base font-normal text-fg-2">/ {formatNumber(max, locale)}</span>
              </p>
              <p className="mt-1 text-xl tracking-widest" aria-hidden="true">
                {runSquares(done.results)}
              </p>
              {board.data?.me && (
                <p className="mt-2 font-mono text-sm text-fg-2">{t("weeklyRank", { rank: board.data.me.rank, n: board.data.players })}</p>
              )}
              {saving === "saving" && (
                <p className="mt-2 font-mono text-xs text-fg-2" role="status">
                  {t("savingScore")}
                </p>
              )}
              {member && !stored.sent && !board.data?.me && saving !== "saving" && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {saving === "failed" && (
                    <span className="form-error" role="alert">
                      {t("scoreNotSaved")}
                    </span>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => onSend(done)}>
                    {saving === "failed" ? t("retry") : t("saveScore")}
                  </Button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <ShareKey text={shareText} label={t("weeklyChallenge")} variant="primary" />
              </div>
              <p className="mt-3 font-mono text-xs text-fg-3">
                {t("weeklyNext", { time: now ? timeLeft(weekEndsAt(week), now) : "…" })}
              </p>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="play" size="lg" icon={<Icon name="play" />} onClick={onStart}>
                {stored.run ? t("weeklyResume") : t("weeklyPlay")}
              </Button>
              <span className="self-center font-mono text-sm text-fg-2">{t("puzzles", { n: stageCount(settings) })}</span>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader eyebrow={t("players", { n: board.data?.players ?? 0 })} title={t("weeklyBoard")} level={2} />
          {board.error && !board.data ? (
            <EmptyState icon={<Icon name="trophy" />} title={isMissingFeature(board.error) ? t("unavailableTitle") : t("errGeneric")} className="!py-6">
              {t("unavailableLead")}
            </EmptyState>
          ) : !board.data ? (
            <div className="skeleton-block h-40" aria-busy="true" />
          ) : board.data.rows.length === 0 ? (
            <EmptyState icon={<Icon name="trophy" />} title={t("weeklyBoardEmpty")} className="!py-6" />
          ) : (
            <ol className="board">
              {board.data.rows.map((row) => (
                <li key={row.user.id} data-rank={row.rank <= 3 ? row.rank : undefined} data-me={row.user.id === me?.id ? "" : undefined}>
                  <span className="board-rank">{row.rank}</span>
                  <Player user={row.user} />
                  <strong className="board-points">{formatNumber(row.points, locale)}</strong>
                </li>
              ))}
            </ol>
          )}
          {!me && account.status !== "loading" && (
            <p className="mt-3 text-sm text-fg-2">
              {t("weeklyGuest")}{" "}
              <Link href="/account?next=/weekly" className="text-accent underline">
                {t("signInOrUp")}
              </Link>
            </p>
          )}
          {me && !me.username && (
            <p className="mt-3 text-sm text-fg-2">
              <ButtonLink href="/community" variant="secondary" size="sm">
                {ts("pickUsernameAction")}
              </ButtonLink>
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
