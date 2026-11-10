"use client";

import Link from "next/link";
import { ActionForm, UsernameField } from "@/account/form";
import { updateAccount, useAccount, type Account } from "@/account/state";
import { useSocialT } from "./messages";
import { SocialTabs, type SocialTab } from "./tabs";

/** A signed-in player who has picked their public handle. */
export type Member = Account & { username: string };

type Props = {
  /** Which community page this is, for the tabs shown to those who cannot come in yet. */
  tab: SocialTab;
  children: (me: Member) => React.ReactNode;
};

/**
 * Lets members in. Visitors are pointed to the sign-in page, and players
 * without a handle pick one here: it is how others find and see them.
 */
export function Members({ tab, children }: Props) {
  const state = useAccount();
  const { t } = useSocialT();

  if (state.status === "user" && state.account.username) return children(state.account as Member);

  return (
    <main className="page page-narrow" aria-busy={state.status === "loading"}>
      <SocialTabs current={tab} />
      {state.status === "loading" && <div className="page-skeleton skeleton-block" />}
      {state.status === "guest" && (
        <section className="notice">
          <h1>{t("joinTitle")}</h1>
          <p>{t("joinLead")}</p>
          <div className="page-actions">
            <Link href="/account" className="button">
              {t("joinAction")}
            </Link>
          </div>
        </section>
      )}
      {state.status === "user" && (
        <section className="notice">
          <h1>{t("pickUsernameTitle")}</h1>
          <p>{t("pickUsernameLead")}</p>
          <ActionForm action={({ username }) => updateAccount({ username })} submitLabel={t("pickUsernameAction")}>
            <UsernameField />
          </ActionForm>
        </section>
      )}
    </main>
  );
}
