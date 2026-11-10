"use client";

import { Settings } from "./settings";
import { SignIn } from "./sign-in";
import { useAccount } from "./state";

/** The /account page: a sign-in form for visitors, settings for players. */
export function AccountPage() {
  const state = useAccount();
  return (
    <main className="account" aria-busy={state.status === "loading"}>
      {state.status === "loading" && <div className="account-skeleton skeleton-block" />}
      {state.status === "guest" && <SignIn />}
      {state.status === "user" && <Settings account={state.account} />}
    </main>
  );
}
