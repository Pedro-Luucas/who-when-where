"use client";

import { useState } from "react";
import { errorKey, useAccountT } from "./messages";

/** A labelled text input. Extra props go to the <input>. */
export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...input} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** The public handle: letters, digits and underscores. */
export function UsernameField({ defaultValue, optional }: { defaultValue?: string; optional?: boolean }) {
  const t = useAccountT();
  return (
    <Field
      label={t("username")}
      name="username"
      defaultValue={defaultValue}
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      required={!optional}
      minLength={3}
      maxLength={20}
      pattern="[A-Za-z0-9_]{3,20}"
      hint={t("usernameHint")}
    />
  );
}

type Props = {
  /** Receives the form's fields by name. Reject with an ApiError to show its message. */
  action: (values: Record<string, string>) => Promise<void>;
  submitLabel: string;
  /** Shown after a success; the fields are cleared too. */
  doneLabel?: string;
  danger?: boolean;
  children: React.ReactNode;
};

/** A form that runs an account action: disables while it runs, then shows the outcome. */
export function ActionForm({ action, submitLabel, doneLabel, danger, children }: Props) {
  const t = useAccountT();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<{ error: unknown } | "done" | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setPending(true);
    setOutcome(null);
    try {
      await action(values);
      if (doneLabel) form.reset();
      setOutcome("done");
    } catch (error) {
      setOutcome({ error });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      {children}
      {outcome && outcome !== "done" && (
        <p className="form-error" role="alert">
          {t(errorKey(outcome.error))}
        </p>
      )}
      {outcome === "done" && doneLabel && (
        <p className="form-done" role="status">
          {doneLabel}
        </p>
      )}
      <button type="submit" className={danger ? "button button-danger" : "button"} disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
