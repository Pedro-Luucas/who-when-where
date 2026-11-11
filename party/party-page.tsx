"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BrowserOnly, Segmented } from "@/components/controls";
import { DEFAULT_SETTINGS, normalizeSettings, type ExpeditionSettings } from "@/expedition/settings";
import { useSettingsLine } from "@/expedition/setup";
import { SETTINGS_KEY } from "@/expedition/solo";
import { readStore } from "@/lib/storage";
import { Player } from "@/social/avatar";
import { createParty, listParties, type PartySummary, type Visibility } from "@/social/client";
import { Invitations } from "@/social/community";
import { Members, type Member } from "@/social/gate";
import { socialError, useSocialT } from "@/social/messages";
import { useRemote } from "@/social/remote";
import { SocialTabs } from "@/social/tabs";
import { Room } from "./room";

const LIST_EVERY_MS = 6000;

/** /party: the parties to join or open — or, with ?code=, a party's room. */
export function PartyPage() {
  return (
    <BrowserOnly>
      <Members tab="party">{(me) => <Party me={me} />}</Members>
    </BrowserOnly>
  );
}

function Party({ me }: { me: Member }) {
  const params = useSearchParams();
  const code = params.get("code")?.trim().toUpperCase();
  // Keyed by code: each room starts from nothing. A bare shared link asks before joining.
  return code ? <Room key={code} code={code} me={me} joinAtOnce={params.get("join") === "1"} /> : <Parties me={me} />;
}

function Parties({ me }: { me: Member }) {
  const { t } = useSocialT();
  const router = useRouter();
  const parties = useRemote("parties", listParties, LIST_EVERY_MS);
  const settingsLine = useSettingsLine();
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  // A new party starts from the rules last used for an expedition.
  const settings: ExpeditionSettings = normalizeSettings(readStore(SETTINGS_KEY, DEFAULT_SETTINGS));

  async function open(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    setBusy(true);
    setFailure(null);
    try {
      const { party } = await createParty({ name, settings, visibility });
      router.push(`/party?code=${party.code}`);
    } catch (problem) {
      setFailure(problem);
      setBusy(false);
    }
  }

  function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
      .trim()
      .toUpperCase();
    if (code) router.push(`/party?code=${encodeURIComponent(code)}&join=1`);
  }

  const list = (entries: PartySummary[], action: string) =>
    entries.map((party) => (
      <li key={party.code}>
        <Player
          user={party.host}
          note={`${party.name || t("partyOf", { name: party.host.name })} · ${t("playersOf", { n: party.players })} · ${t(
            "puzzleCount",
            { n: party.stages },
          )}`}
        />
        <span className="relation">
          {party.status === "playing" && <span className="chip chip-flat">{t("inGame")}</span>}
          <button type="button" className="chip chip-solid" onClick={() => router.push(`/party?code=${party.code}&join=1`)}>
            {action}
          </button>
        </span>
      </li>
    ));

  return (
    <main className="page">
      <SocialTabs current="party" />
      <header className="page-head">
        <h1>{t("party")}</h1>
        <p>{t("partyLead")}</p>
      </header>

      <Invitations />

      <div className="community">
        <section className="panel" aria-labelledby="open-party">
          <header className="panel-head">
            <h2 id="open-party">{t("openParty")}</h2>
          </header>
          <form className="account-form" onSubmit={open}>
            <label className="field">
              <span>{t("partyName")}</span>
              <input name="name" maxLength={40} defaultValue={t("partyOf", { name: me.displayName || me.username })} />
            </label>
            <div>
              <Segmented
                label={t("visibility")}
                options={[
                  { value: "private" as Visibility, label: t("visibility_private") },
                  { value: "public" as Visibility, label: t("visibility_public") },
                ]}
                value={visibility}
                onChange={setVisibility}
              />
              <p className="hint">{t(`visibilityHint_${visibility}`)}</p>
            </div>
            <p className="hint">
              {t("partyRulesNote")} <b>{settingsLine(settings)}</b>
            </p>
            {failure !== null && (
              <p className="form-error" role="alert">
                {t(socialError(failure))}
              </p>
            )}
            <button type="submit" className="button" disabled={busy}>
              {t("openParty")}
            </button>
          </form>

          <form className="join-form" onSubmit={join}>
            <label className="field">
              <span>{t("joinWithCode")}</span>
              <input
                name="code"
                maxLength={8}
                placeholder="ABCDE"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </label>
            <button type="submit" className="button button-quiet">
              {t("join")}
            </button>
          </form>
        </section>

        <section className="panel" aria-labelledby="party-list">
          {parties.data && parties.data.mine.length > 0 && (
            <>
              <header className="panel-head">
                <h2>{t("yourParties")}</h2>
              </header>
              <ul className="people">{list(parties.data.mine, t("enter"))}</ul>
            </>
          )}
          <header className="panel-head">
            <h2 id="party-list">{t("openParties")}</h2>
          </header>
          <ul className="people">
            {parties.data && list(parties.data.open, t("join"))}
            {parties.data?.open.length === 0 && <li className="people-empty">{t("noOpenParties")}</li>}
            {!parties.data && !parties.error && <li className="people-empty">…</li>}
            {parties.error && !parties.data && <li className="form-error">{t(socialError(parties.error))}</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
