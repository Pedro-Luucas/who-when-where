"use client";

import { useState } from "react";
import { ActionForm, Field } from "./form";
import { useAccountT } from "./messages";
import { signIn, signUp } from "./state";

/** What a visitor without a session sees: sign in, or create an account. */
export function SignIn() {
  const t = useAccountT();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <h1>{t(creating ? "signUp" : "signIn")}</h1>
      <p className="account-lead">{t(creating ? "signUpLead" : "signInLead")}</p>

      {/* Keyed so switching clears the password and any error. */}
      <ActionForm
        key={creating ? "up" : "in"}
        action={({ email, password }) => (creating ? signUp(email, password) : signIn(email, password))}
        submitLabel={t(creating ? "signUp" : "signIn")}
      >
        <Field label={t("email")} name="email" type="email" autoComplete="email" required maxLength={254} />
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
