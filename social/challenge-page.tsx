"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/account/state";
import { BrowserOnly } from "@/components/controls";
import { Icon } from "@/components/shell/nav-items";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { isRunOver, newRun, runMax, runTotal, type Run } from "@/expedition/run";
import { Runner } from "@/expedition/runner";
import { newSeed, stageCount } from "@/expedition/settings";
import { useSettingsLine } from "@/expedition/setup";
import { usePreloadedGames } from "@/expedition/stages";
import { formatNumber } from "@/lib/i18n";
import { usePersistent } from "@/lib/storage";
import { Avatar, Player } from "./avatar";
import { createChallenge, enterChallenge, getChallenge, type Challenge, type ChallengeEntry } from "./connect";
import { isMissingFeature, useConnectT } from "./connect-messages";
import { RelationButton } from "./friends";
import { useSocialT } from "./messages";
import { refreshPulse } from "./pulse";
import { useRemote } from "./remote";
import { HeadToHead, RunGames, runSquares } from "./run-parts";
import { ShareKey } from "./share-key";
import { SocialTabs } from "./tabs";

// A challenge's page, /c/<id>: who sent it and what they scored, a way to
// play the very same puzzles, and afterwards the head-to-head, the board and a
// rematch. The run is kept on the device while it is played, so a reload (or
// signing in halfway) picks up where it was; the score goes to the server
// once the player is signed in.

type Stored = {
  /** The run of this challenge's puzzles. */
  run: Run | null;
  /** A rematch being played: new puzzles, same rules, sent back to the sender. */
  rematch: Run | null;
};

const NOTHING: Stored = { run: null, rematch: null };

export function ChallengePage({ id }: { id: string }) {
  return (
    <BrowserOnly>
      <ChallengeView id={id} />
    </BrowserOnly>
  );
}

function ChallengeView({ id }: { id: string }) {
  const { t } = useConnectT();
  const { t: ts } = useSocialT();
  const account = useAccount();
  const me = account.status === "user" ? account.account : null;
  const viewerKey = me?.id ?? account.status;
  const remote = useRemote(account.status === "loading" ? null : `challenge:${id}:${viewerKey}`, () => getChallenge(id));
  const [stored, setStored] = usePersistent<Stored>(`challenge:${id}`, NOTHING);
  const challenge = remote.data;
  usePreloadedGames(challenge && !challenge.mine ? challenge.settings : null);
  const [saving, setSaving] = useState<Saving>("idle");
  const member = !!me?.username;

  /** Puts a finished run on the challenge's board. */
  async function submit(run: Run) {
    if (!challenge || !member || challenge.from.id === me?.id) return;
    setSaving("saving");
    try {
      await enterChallenge(challenge.id, run.results.map(({ points, detail }) => ({ points, detail })));
      setSaving("idle");
      remote.reload();
      void refreshPulse();
    } catch {
      setSaving("failed");
    }
  }

  if (stored.rematch && !isRunOver(stored.rematch) && challenge) {
    return (
      <RematchRun
        challenge={challenge}
        run={stored.rematch}
        onChange={(rematch) => setStored((previous) => ({ ...previous, rematch }))}
        onQuit={() => setStored((previous) => ({ ...previous, rematch: null }))}
      />
    );
  }
  if (stored.run && !isRunOver(stored.run) && !challenge?.mine) {
    return (
      <Runner
        run={stored.run}
        onChange={(run) => setStored((previous) => ({ ...previous, run }))}
        onFinish={(run) => {
          setStored((previous) => ({ ...previous, run }));
          void submit(run);
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
    <main className="page">
      <SocialTabs />
      {!challenge && !remote.error && <div className="page-skeleton skeleton-block" aria-busy="true" />}
      {remote.error && !challenge && (
        remote.error.code === "no_such_challenge" ? (
          <EmptyState
            icon={<Icon name="swords" />}
            title={t("challengeNotFoundTitle")}
            action={<ButtonLink href="/daily">{t("playDailies")}</ButtonLink>}
          >
            {t("challengeNotFoundLead")}
          </EmptyState>
        ) : (
          <EmptyState
            icon={<Icon name="clock" />}
            title={isMissingFeature(remote.error) ? t("unavailableTitle") : t("errGeneric")}
            action={
              <Button variant="secondary" onClick={remote.reload}>
                {t("retry")}
              </Button>
            }
          >
            {t("unavailableLead")}
          </EmptyState>
        )
      )}
      {challenge && (
        <Details
          challenge={challenge}
          stored={stored}
          onStart={() => setStored({ ...stored, run: newRun(`challenge:${id}`, challenge.seed, challenge.settings) })}
          onRematch={() =>
            setStored({ ...stored, rematch: newRun(`rematch:${id}:${Date.now()}`, newSeed(), challenge.settings) })
          }
          reload={remote.reload}
          saving={saving}
          onSubmit={(run) => void submit(run)}
          signedIn={!!me}
          member={member}
          myId={me?.id ?? null}
        />
      )}
    </main>
  );
}

type Saving = "idle" | "saving" | "failed";

type DetailsProps = {
  saving: Saving;
  onSubmit: (run: Run) => void;
  challenge: Challenge;
  stored: Stored;
  onStart: () => void;
  onRematch: () => void;
  reload: () => void;
  signedIn: boolean;
  member: boolean;
  myId: string | null;
};

function Details({ challenge, stored, onStart, onRematch, reload, saving, onSubmit, signedIn, member, myId }: DetailsProps) {
  const { locale, t } = useConnectT();
  const settingsLine = useSettingsLine();
  const sender = challenge.from;
  const isSender = myId === sender.id;
  const max = runMax(challenge.settings);
  const theirEntry = challenge.entries.find((entry) => entry.user.id === sender.id);
  const senderPoints = theirEntry?.points ?? 0;
  const finishedHere = stored.run && isRunOver(stored.run) ? stored.run : null;
  // What the viewer scored: the server's record, or the run just finished on this device.
  const mine: { points: number; results: { points: number; detail: string }[] } | null =
    challenge.mine ??
    (finishedHere ? { points: runTotal(finishedHere.results), results: finishedHere.results.map(({ points, detail }) => ({ points, detail })) } : null);

  // Whom the viewer is measured against: the sender, or (for the sender) the best of the rest.
  const rival: ChallengeEntry | undefined = isSender
    ? challenge.entries.find((entry) => entry.user.id !== sender.id)
    : theirEntry;
  const diff = mine && rival ? mine.points - rival.points : 0;
  const link = () => `${window.location.origin}/c/${challenge.id}`;
  const shareText = () => {
    const name = isSender || !mine ? sender.name : (challenge.mine?.user.name ?? sender.name);
    const points = isSender || !mine ? senderPoints : mine.points;
    const squares = runSquares(isSender || !mine ? (theirEntry?.results ?? []) : mine.results);
    return [
      t("challengeShareText", { name, points: formatNumber(points, locale), max: formatNumber(max, locale) }),
      squares,
      link(),
    ]
      .filter(Boolean)
      .join("\n");
  };

  return (
    <>
      <Card className="rise-in mb-5" family="where">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={sender.name} color={sender.avatar} size="large" />
          <div className="min-w-[14rem] flex-1">
            <p className="eyebrow">{challenge.to ? t("challengeDuel", { username: challenge.to.username }) : t("challengeNoun")}</p>
            <h1 className="font-display text-3xl font-bold text-fg">
              {isSender ? t("challengeYours") : t("challengeFrom", { name: sender.name })}
            </h1>
            <p className="mt-1 text-fg-2">
              {isSender
                ? t("challengeYoursLead")
                : t("challengeScored", {
                    name: sender.name,
                    points: formatNumber(senderPoints, locale),
                    max: formatNumber(max, locale),
                  })}
            </p>
          </div>
          <div className="w-full sm:w-auto sm:text-right">
            <p className="font-mono text-4xl font-bold text-[var(--streak)] tabular-nums">{formatNumber(senderPoints, locale)}</p>
            <p className="font-mono text-xs text-fg-2">/ {formatNumber(max, locale)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <RunGames settings={challenge.settings} />
          <p className="font-mono text-xs text-fg-2">
            {settingsLine(challenge.settings)} · {t("players", { n: challenge.players })}
          </p>
        </div>
        {!mine && !isSender && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="play" size="lg" icon={<Icon name="play" />} onClick={onStart}>
              {stored.run ? t("challengeResume") : t("challengeAccept")}
            </Button>
          </div>
        )}
      </Card>

      {mine && (
        <Card className="rise-in mb-5">
          <CardHeader
            eyebrow={t("h2h")}
            title={
              !rival ? (
                `${formatNumber(mine.points, locale)} / ${formatNumber(max, locale)}`
              ) : diff > 0 ? (
                <span className="text-answer">{t("h2hWin", { n: formatNumber(diff, locale) })}</span>
              ) : diff < 0 ? (
                t("h2hLose", { name: rival.user.name, n: formatNumber(-diff, locale) })
              ) : (
                t("h2hTie")
              )
            }
          />
          {rival && (
            <HeadToHead settings={challenge.settings} seed={challenge.seed} mine={mine.results} theirs={rival.results} name={rival.user.name} />
          )}
          {saving === "saving" && <p className="mt-3 font-mono text-xs text-fg-2" role="status">{t("savingScore")}</p>}
          {finishedHere && !challenge.mine && !isSender && member && saving !== "saving" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {saving === "failed" && (
                <span className="form-error" role="alert">
                  {t("scoreNotSaved")}
                </span>
              )}
              <Button variant="secondary" size="sm" onClick={() => onSubmit(finishedHere)}>
                {saving === "failed" ? t("retry") : t("saveScore")}
              </Button>
            </div>
          )}
          {!challenge.mine && !isSender && !member && (
            <p className="mt-4 text-fg-2">
              {t("signInToScore", { name: sender.name })}{" "}
              <Link href={`/account?next=/c/${challenge.id}`} className="text-accent underline">
                {t(signedIn ? "signIn" : "signInOrUp")}
              </Link>
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <ShareKey text={shareText} label={t("challengeShare")} variant="primary" />
            {!isSender && member && (
              <Button variant="play" icon={<Icon name="swords" />} onClick={onRematch}>
                {t("rematch")}
              </Button>
            )}
          </div>
          {!isSender && member && <p className="mt-2 text-sm text-fg-3">{t("rematchLead", { name: sender.name })}</p>}
          {challenge.relation === "none" && challenge.mine && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-sunken/60 p-3">
              <span className="text-sm text-fg-2">{t("addAfterChallenge", { name: sender.name })}</span>
              <RelationButton user={sender} relation="none" onChange={reload} />
            </div>
          )}
        </Card>
      )}

      {isSender && !mine && (
        <div className="mb-5 flex flex-wrap gap-3">
          <ShareKey text={shareText} label={t("challengeShare")} variant="primary" />
        </div>
      )}

      <Card>
        <CardHeader eyebrow={t("players", { n: challenge.players })} title={t("challengeBoard")} />

        <ol className="board">
          {challenge.entries.map((entry, i) => (
            <li key={entry.user.id} data-rank={i < 3 ? i + 1 : undefined} data-me={entry.user.id === myId ? "" : undefined}>
              <span className="board-rank">{i + 1}</span>
              <Player user={entry.user} note={runSquares(entry.results)} />
              <strong className="board-points">{formatNumber(entry.points, locale)}</strong>
            </li>
          ))}
        </ol>
        {challenge.entries.length <= 1 && (
          <p className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-line-strong bg-sunken/60 p-3 text-sm text-fg-2">
            <Icon name="trophy" /> {t("challengeBoardEmpty")}
          </p>
        )}
        <p className="mt-3 font-mono text-xs text-fg-3">
          {t("puzzles", { n: stageCount(challenge.settings) })} · {t("challengeLinkHint")}
        </p>
      </Card>
    </>
  );
}

/** A rematch: new puzzles, the same rules; when it ends it goes back to the sender as a new challenge. */
function RematchRun({
  challenge,
  run,
  onChange,
  onQuit,
}: {
  challenge: Challenge;
  run: Run;
  onChange: (run: Run) => void;
  onQuit: () => void;
}) {
  const { t: ts } = useSocialT();
  const router = useRouter();

  async function finish(done: Run) {
    onChange(done);
    try {
      const sent = await createChallenge({
        seed: done.seed,
        settings: challenge.settings,
        results: done.results.map(({ points, detail }) => ({ points, detail })),
        to: challenge.relation === "friends" ? challenge.from.username : undefined,
        replyTo: challenge.id,
      });
      onQuit();
      router.push(`/c/${sent.id}`);
    } catch {
      // The rematch stays on the device; the player can share it from the expedition page.
      onQuit();
    }
  }

  return (
    <Runner
      run={run}
      onChange={onChange}
      onFinish={(done) => void finish(done)}
      aside={
        <button
          type="button"
          className="run-quit"
          onClick={() => {
            if (window.confirm(ts("quitConfirm"))) onQuit();
          }}
        >
          {ts("quit")}
        </button>
      }
    />
  );
}
