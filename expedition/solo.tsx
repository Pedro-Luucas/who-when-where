"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/account/state";
import { BrowserOnly } from "@/components/controls";
import { formatNumber } from "@/lib/i18n";
import { copyText } from "@/lib/share";
import { usePersistent } from "@/lib/storage";
import { createChallenge } from "@/social/connect";
import { useConnectT } from "@/social/connect-messages";
import { useSocialT } from "@/social/messages";
import { SocialTabs } from "@/social/tabs";
import { isRunOver, newRun, runMax, runTotal, type Run } from "./run";
import { Runner } from "./runner";
import {
  DEFAULT_SETTINGS,
  decodeChallenge,
  encodeChallenge,
  newSeed,
  normalizeSettings,
  stageCount,
  type ExpeditionSettings,
} from "./settings";
import { SettingsForm, useSettingsLine } from "./setup";
import { usePreloadedGames } from "./stages";
import { RunSummary, runShareText } from "./summary";

// An expedition played alone. Nothing leaves the device: the run and the
// settings live in lib/storage, so no account is needed.

/** The settings last used, shared with the party pages. */
export const SETTINGS_KEY = "expedition:settings";

type Past = { at: number; total: number; max: number; puzzles: number };
type Solo = {
  run: Run | null;
  past: Past[];
  /** A friend's username: the run is sent to them as a challenge when it ends. */
  duel?: string | null;
  /** The challenge made from a finished run (its id on the server), so sharing twice reuses it. */
  challenge?: { runId: string; id: string; to?: string | null } | null;
  /** Sending the duel failed: the run can still be shared as a link. */
  duelFailed?: boolean;
};

const SOLO_KEY = "expedition:solo";
const EMPTY: Solo = { run: null, past: [] };
const PAST_KEPT = 8;

export function SoloExpedition() {
  return (
    <BrowserOnly>
      <Expedition />
    </BrowserOnly>
  );
}

function Expedition() {
  const { locale, t } = useSocialT();
  const { t: tc } = useConnectT();
  const router = useRouter();
  const account = useAccount();
  const member = account.status === "user" && !!account.account.username;
  const [solo, setSolo] = usePersistent<Solo>(SOLO_KEY, EMPTY);
  const [stored, setSettings] = usePersistent<ExpeditionSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const settings = normalizeSettings(stored);
  const settingsLine = useSettingsLine();
  const [copied, setCopied] = useState(false);

  // A link from a friend carries their expedition: same puzzles, same rules.
  const search = useSearchParams();
  const challenge = decodeChallenge(search.get("c"));
  // From a friend's profile: "Challenge" sets up a run that goes to them.
  const duelParam = search.get("duel");
  const duelTarget = duelParam && /^[a-z0-9_]{3,20}$/i.test(duelParam) ? duelParam.toLowerCase() : null;
  const { run } = solo;
  // While the settings are on screen, the games they call for are fetched.
  usePreloadedGames(run && !challenge ? null : (challenge?.settings ?? settings));

  function start(seed: string, rules: ExpeditionSettings, duel: string | null = null) {
    setSolo((previous) => ({ ...previous, run: newRun(`solo:${seed}`, seed, rules), duel, challenge: null, duelFailed: false }));
    if (challenge || duelTarget) router.replace("/expedition");
    window.scrollTo({ top: 0 });
  }

  /** Stores a finished run as a challenge on the server (once), sent to `to` if given. */
  async function challengeOf(finished: Run, to: string | null = null): Promise<string> {
    if (solo.challenge?.runId === finished.id) return solo.challenge.id;
    const made = await createChallenge({
      seed: finished.seed,
      settings: normalizeSettings(finished.settings),
      results: finished.results.map(({ points, detail }) => ({ points, detail })),
      ...(to ? { to } : {}),
    });
    setSolo((previous) => ({ ...previous, challenge: { runId: finished.id, id: made.id, to } }));
    return made.id;
  }

  function finish(finished: Run) {
    const entry: Past = {
      at: Date.now(),
      total: runTotal(finished.results),
      max: runMax(finished.settings),
      puzzles: stageCount(finished.settings),
    };
    const duel = solo.duel ?? null;
    setSolo({ run: finished, past: [entry, ...solo.past].slice(0, PAST_KEPT), duel: null, challenge: null });
    if (duel) {
      void challengeOf(finished, duel).catch(() => setSolo((previous) => ({ ...previous, duelFailed: true })));
    }
  }

  if (run && !isRunOver(run)) {
    return (
      <Runner
        run={run}
        onChange={(next) => setSolo((previous) => ({ ...previous, run: next }))}
        onFinish={finish}
        aside={
          <button
            type="button"
            className="run-quit"
            onClick={() => {
              if (window.confirm(t("quitConfirm"))) setSolo((previous) => ({ ...previous, run: null }));
            }}
          >
            {t("quit")}
          </button>
        }
      />
    );
  }

  // A challenge link wins over the previous finished run's summary (it used to be ignored).
  if (run && !challenge && !duelTarget) {
    const sent = solo.challenge?.runId === run.id ? solo.challenge : null;
    return (
      <main className="page page-narrow">
        <SocialTabs current="expedition" />
        <RunSummary run={run} />
        {sent?.to && (
          <section className="notice" role="status">
            <p>{tc("duelSent", { username: sent.to })}</p>
            <div className="page-actions">
              <Link href={`/c/${sent.id}`} className="button button-quiet">
                {tc("duelOpen")}
              </Link>
            </div>
          </section>
        )}
        {solo.duelFailed && <p className="form-error">{tc("scoreNotSaved")}</p>}
        <div className="page-actions">
          <button
            type="button"
            className="button"
            onClick={async () => {
              // Signed-in players share a challenge page (/c/<id>) with their name and score on it;
              // otherwise, or with an API from before challenges, the link carries the run itself.
              let link = `${window.location.origin}/expedition?c=${encodeChallenge(run)}`;
              if (member) {
                try {
                  link = `${window.location.origin}/c/${await challengeOf(run)}`;
                } catch {
                  // keep the self-contained link
                }
              }
              if (await copyText(runShareText(run, locale, link))) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2400);
              }
            }}
          >
            {copied ? t("copied") : t("shareChallenge")}
          </button>
          <button type="button" className="button button-quiet" onClick={() => start(newSeed(), normalizeSettings(run.settings))}>
            {t("playAgain")}
          </button>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => setSolo((previous) => ({ ...previous, run: null }))}
          >
            {t("changeSettings")}
          </button>
        </div>
        <p className="hint">{t("shareChallengeHint")}</p>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <SocialTabs current="expedition" />
      <header className="page-head">
        <h1>{t("expedition")}</h1>
        <p>{t("expeditionLead")}</p>
      </header>

      {duelTarget && !challenge && (
        <section className="notice" role="status">
          <p className="eyebrow">{tc("challengeNoun")}</p>
          <p>{tc("duelBanner", { username: duelTarget })}</p>
        </section>
      )}

      {challenge ? (
        <section className="notice">
          <p className="eyebrow">{t("challengeTitle")}</p>
          <p>{t("challengeLead")}</p>
          <p className="hint">{settingsLine(challenge.settings)}</p>
          <div className="page-actions">
            <button type="button" className="button" onClick={() => start(challenge.seed, challenge.settings)}>
              {t("acceptChallenge")}
            </button>
            <button type="button" className="button button-quiet" onClick={() => router.replace("/expedition")}>
              {t("declineChallenge")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <SettingsForm value={settings} onChange={setSettings} />
          <div className="page-actions">
            <button type="button" className="button" onClick={() => start(newSeed(), settings, member ? duelTarget : null)}>
              {t("startExpedition")}
            </button>
            {duelTarget && (
              <button type="button" className="button button-quiet" onClick={() => router.replace("/expedition")}>
                {tc("duelCancel")}
              </button>
            )}
            <Link href="/party" className="button button-quiet">
              {t("playWithFriends")}
            </Link>
          </div>
          <p className="hint">{t("playWithFriendsHint")}</p>
        </>
      )}

      {solo.past.length > 0 && (
        <section className="past">
          <h2 className="eyebrow">{t("pastExpeditions")}</h2>
          <ol>
            {solo.past.map((entry) => (
              <li key={entry.at}>
                <time>
                  {new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-GB", {
                    day: "numeric",
                    month: "short",
                  }).format(entry.at)}
                </time>
                <span>{t("puzzleCount", { n: entry.puzzles })}</span>
                <b>
                  {formatNumber(entry.total, locale)} / {formatNumber(entry.max, locale)}
                </b>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
