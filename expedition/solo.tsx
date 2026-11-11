"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BrowserOnly } from "@/components/controls";
import { formatNumber } from "@/lib/i18n";
import { copyText } from "@/lib/share";
import { usePersistent } from "@/lib/storage";
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
import { RunSummary, runShareText } from "./summary";

// An expedition played alone. Nothing leaves the device: the run and the
// settings live in lib/storage, so no account is needed.

/** The settings last used, shared with the party pages. */
export const SETTINGS_KEY = "expedition:settings";

type Past = { at: number; total: number; max: number; puzzles: number };
type Solo = { run: Run | null; past: Past[] };

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
  const router = useRouter();
  const [solo, setSolo] = usePersistent<Solo>(SOLO_KEY, EMPTY);
  const [stored, setSettings] = usePersistent<ExpeditionSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const settings = normalizeSettings(stored);
  const settingsLine = useSettingsLine();
  const [copied, setCopied] = useState(false);

  // A link from a friend carries their expedition: same puzzles, same rules.
  const challenge = decodeChallenge(useSearchParams().get("c"));
  const { run } = solo;

  function start(seed: string, rules: ExpeditionSettings) {
    setSolo((previous) => ({ ...previous, run: newRun(`solo:${seed}`, seed, rules) }));
    if (challenge) router.replace("/expedition");
    window.scrollTo({ top: 0 });
  }

  function finish(finished: Run) {
    const entry: Past = {
      at: Date.now(),
      total: runTotal(finished.results),
      max: runMax(finished.settings),
      puzzles: stageCount(finished.settings),
    };
    setSolo({ run: finished, past: [entry, ...solo.past].slice(0, PAST_KEPT) });
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
  if (run && !challenge) {
    const link = `${window.location.origin}/expedition?c=${encodeChallenge(run)}`;
    return (
      <main className="page page-narrow">
        <SocialTabs current="expedition" />
        <RunSummary run={run} />
        <div className="page-actions">
          <button
            type="button"
            className="button"
            onClick={async () => {
              if (await copyText(runShareText(run, locale, link))) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2400);
              }
            }}
          >
            {copied ? t("copied") : t("shareChallenge")}
          </button>
          <button type="button" className="button button-quiet" onClick={() => start(newSeed(), run.settings)}>
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
            <button type="button" className="button" onClick={() => start(newSeed(), settings)}>
              {t("startExpedition")}
            </button>
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
