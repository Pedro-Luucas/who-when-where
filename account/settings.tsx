"use client";

import { LocaleToggle } from "@/components/locale-toggle";
import { SocialSettings } from "@/social/account-social";
import { Avatar, AVATAR_COUNT } from "@/social/avatar";
import { ActionForm, Field, UsernameField } from "./form";
import { PlanSection } from "./plan-section";
import { useAccountT } from "./messages";
import { changePassword, deleteAccount, signOut, updateAccount, type Account } from "./state";

/** What a signed-in player sees: their settings. */
export function Settings({ account }: { account: Account }) {
  const t = useAccountT();

  return (
    <>
      <h1>{t("title")}</h1>
      <p className="account-lead">{t("signedInAs", { email: account.email })}</p>
      <p className="hint account-note">{t("syncNote")}</p>

      <section className="account-section">
        <h2>{t("profile")}</h2>
        <div className="avatar-picker" role="group" aria-label={t("avatar")}>
          {Array.from({ length: AVATAR_COUNT }, (_, color) => (
            <button
              key={color}
              type="button"
              aria-pressed={account.avatar === color}
              aria-label={`${t("avatar")} ${color + 1}`}
              onClick={() => void updateAccount({ avatar: color }).catch(() => {})}
            >
              <Avatar name={account.displayName || account.username || account.email} color={color} />
            </button>
          ))}
        </div>
        <ActionForm
          action={({ username, displayName }) => updateAccount({ ...(username ? { username } : {}), displayName })}
          submitLabel={t("save")}
          doneLabel={t("saved")}
        >
          <UsernameField key={account.username} defaultValue={account.username ?? ""} optional={!account.username} />
          <Field
            key={account.displayName}
            label={t("displayName")}
            name="displayName"
            defaultValue={account.displayName}
            autoComplete="nickname"
            maxLength={40}
            hint={t("displayNameHint")}
          />
        </ActionForm>
      </section>

      <SocialSettings account={account} />

      <PlanSection />

      <section className="account-section">
        <h2>{t("language")}</h2>
        <div className="account-row">
          <LocaleToggle />
          <span className="hint">{t("languageHint")}</span>
        </div>
      </section>

      <details className="account-section">
        <summary>{t("changeEmail")}</summary>
        <ActionForm
          action={({ email, currentPassword }) => updateAccount({ email, currentPassword })}
          submitLabel={t("save")}
          doneLabel={t("emailChanged")}
        >
          <Field label={t("newEmail")} name="email" type="email" autoComplete="email" required maxLength={254} />
          <Field
            label={t("currentPassword")}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
          />
        </ActionForm>
      </details>

      <details className="account-section">
        <summary>{t("changePassword")}</summary>
        <ActionForm
          action={({ currentPassword, newPassword }) => changePassword(currentPassword, newPassword)}
          submitLabel={t("save")}
          doneLabel={t("passwordChanged")}
        >
          <Field
            label={t("currentPassword")}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
          />
          <Field
            label={t("newPassword")}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={200}
            hint={t("passwordHint")}
          />
        </ActionForm>
      </details>

      <section className="account-section">
        <h2>{t("signOut")}</h2>
        <ActionForm action={signOut} submitLabel={t("signOut")}>
          <p className="hint">{t("signOutHint")}</p>
        </ActionForm>
      </section>

      <details className="account-section">
        <summary>{t("deleteAccount")}</summary>
        <ActionForm action={({ password }) => deleteAccount(password)} submitLabel={t("deleteConfirm")} danger>
          <p className="hint">{t("deleteWarning")}</p>
          <Field
            label={t("currentPassword")}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
          />
        </ActionForm>
      </details>
    </>
  );
}
