"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, Field, UsernameField } from "./form";
import { useAccountT } from "./messages";
import { signIn, signUp } from "./state";

/** A same-site path from `?next=`, to go back to once signed in. */
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

type Props = {
  /**
   * Shown inside another page (a community page a visitor cannot use yet):
   * that page gives the title, the form opens on "create an account", and
   * the page carries on in place once the visitor is in.
   */
  embedded?: boolean;
};

/** What a visitor without a session sees: sign in, or create an account. */
export function SignIn({ embedded = false }: Props) {
  const t = useAccountT();
  const router = useRouter();
  const [creating, setCreating] = useState(embedded);

  async function submit({ email, password, username }: Record<string, string>) {
    await (creating ? signUp(email, password, username) : signIn(email, password));
    // From /account?next=/leaderboard: back to where the visitor was.
    const next = embedded ? null : nextPath();
    if (next) router.push(next);
  }

  return (
    <>
      {embedded ? (
        <p className="eyebrow sign-in-switch-head">{t(creating ? "signUp" : "signIn")}</p>
      ) : (
        <>
          <h1>{t(creating ? "signUp" : "signIn")}</h1>
          <p className="account-lead">{t(creating ? "signUpLead" : "signInLead")}</p>
        </>
      )}

      {/* Keyed so switching clears the password and any error. */}
      <ActionForm key={creating ? "up" : "in"} action={submit} submitLabel={t(creating ? "signUp" : "signIn")}>
        <Field label={t("email")} name="email" type="email" autoComplete="email" required maxLength={254} />
        {creating && <UsernameField />}
        <Field
          label={t("password")}
          name="password"
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          required
          minLength={creating ? 8 : undefined}
          maxLength={200}
          hint={creating ? t("passwordHint") : undefined}
        />
      </ActionForm>

      <p className="hint account-note">{t("guestNote")}</p>
      <button type="button" className="link-button" onClick={() => setCreating(!creating)}>
        {t(creating ? "toSignIn" : "toSignUp")}
      </button>
    </>
  );
}
