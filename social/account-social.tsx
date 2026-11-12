"use client";

import { useMemo, useState } from "react";
import { updateAccount, type Account } from "@/account/state";
import { COUNTRIES } from "@/lib/countries";
import { Flag } from "./avatar";
import { useConnectT } from "./connect-messages";
import { PushCard } from "./push-card";
import { ShareKey } from "./share-key";

/**
 * The social part of the account page: who sees the profile, presence, the
 * flag, notifications on this device, and the invitation link.
 */
export function SocialSettings({ account }: { account: Account }) {
  const { locale, t } = useConnectT();
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const countries = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale)),
    [locale],
  );
  // An API from before privacy settings sends none of these: the controls stay hidden.
  const supported = account.profileVisibility !== undefined;

  async function change(changes: Parameters<typeof updateAccount>[0]) {
    setSaved(false);
    setFailed(false);
    try {
      await updateAccount(changes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      {supported && (
        <section className="account-section">
          <h2>
            {t("privacy")}{" "}
            {saved && (
              <small className="ml-2 font-mono text-xs text-answer" role="status">
                {t("privacySaved")}
              </small>
            )}
          </h2>
          <div className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="eyebrow mb-1">{t("visibility")}</legend>
              <div className="segmented" role="group" aria-label={t("visibility")}>
                {(["public", "friends"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={account.profileVisibility === value}
                    onClick={() => void change({ profileVisibility: value })}
                  >
                    {t(`visibility_${value}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-[var(--accent)]"
                checked={!!account.hidePresence}
                onChange={(event) => void change({ hidePresence: event.target.checked })}
              />
              <span>{t("hidePresence")}</span>
            </label>
            <label className="field">
              <span className="flex items-center gap-2">
                {t("country")} <Flag code={account.country} />
              </span>
              <select
                value={account.country?.toLowerCase() ?? ""}
                onChange={(event) => void change({ country: event.target.value ? event.target.value.toUpperCase() : null })}
              >
                <option value="">{t("countryNone")}</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name[locale]}
                  </option>
                ))}
              </select>
              <small className="hint">{t("countryHint")}</small>
            </label>
            {failed && (
              <p className="form-error" role="alert">
                {t("errGeneric")}
              </p>
            )}
          </div>
        </section>
      )}

      <PushCard />

      {account.username && (
        <section className="account-section">
          <h2>{t("yourInvite")}</h2>
          <p className="hint mb-3">{t("yourInviteLead")}</p>
          <code className="mb-3 block truncate rounded-md border border-line bg-sunken px-3 py-2 font-mono text-sm text-fg-2">
            {typeof window === "undefined" ? "" : `${window.location.origin}/i/${account.username}`}
          </code>
          <ShareKey
            text={() => `${t("inviteShareText")}\n${window.location.origin}/i/${account.username}`}
            label={t("copyInvite")}
            variant="primary"
          />
        </section>
      )}
    </>
  );
}
