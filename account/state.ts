"use client";

import { useSyncExternalStore } from "react";
import { getLocale, setLocale, type Locale } from "@/lib/i18n";
import { readStore, subscribeToStore, writeStore } from "@/lib/storage";
import { ApiError, api } from "./api";
import { forgetGames, pushGames, syncGames } from "./sync";

// Who is signed in. The session itself is an HttpOnly cookie that scripts
// cannot see, so the state lives here: asked from the server once per visit,
// then kept in step by the actions below.

export type Account = {
  id: string;
  email: string;
  /** May be empty. */
  displayName: string;
  locale: Locale;
  createdAt: number;
};

export type AccountState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "user"; account: Account };

// A hint that survives reloads and reaches other tabs. Visitors who never
// signed in cost the server nothing: we only ask who they are if it is set.
const SIGNED_IN_KEY = "account:signed-in";

const LOADING: AccountState = { status: "loading" };
const GUEST: AccountState = { status: "guest" };
const PUSH_DELAY_MS = 1000;

let state: AccountState = LOADING;
const listeners = new Set<() => void>();
let started = false;
let restoring = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

function setState(next: AccountState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    subscribeToStore(onStoreChange);
    if (readStore(SIGNED_IN_KEY, false)) void restore();
    else setState(GUEST);
  }
  return () => listeners.delete(listener);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

/** Asks the server who the session cookie belongs to. */
async function restore(): Promise<void> {
  if (restoring) return;
  restoring = true;
  try {
    const { user } = await api<{ user: Account }>("GET", "/me");
    enter(user);
  } catch (error) {
    endIfSignedOut(error);
    setState(GUEST);
  } finally {
    restoring = false;
  }
}

function enter(account: Account): void {
  // The account's language wins on this device. Set it before the state, or
  // onStoreChange would read the difference as the player picking a language.
  if (getLocale() !== account.locale) setLocale(account.locale);
  setState({ status: "user", account });
  writeStore(SIGNED_IN_KEY, true);
  syncGames(account.id).catch(endIfSignedOut);
}

function leave(): void {
  clearTimeout(pushTimer);
  writeStore(SIGNED_IN_KEY, false);
  setState(GUEST);
}

/** A 401 means the session ended (expired, or closed from another device). */
function endIfSignedOut(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) leave();
}

// Runs on every change to saved data, here or in another tab.
function onStoreChange(): void {
  const signedIn = readStore(SIGNED_IN_KEY, false);
  if (state.status === "guest") {
    if (signedIn) void restore(); // signed in from another tab
    return;
  }
  if (state.status !== "user") return;
  if (!signedIn) {
    setState(GUEST); // signed out from another tab
    return;
  }

  const locale = getLocale();
  if (locale !== state.account.locale) {
    setState({ status: "user", account: { ...state.account, locale } });
    api("PATCH", "/me", { locale }).catch(endIfSignedOut);
  }

  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (state.status === "user") pushGames().catch(endIfSignedOut);
  }, PUSH_DELAY_MS);
}

// ── Actions. Each rejects with an ApiError when the server refuses. ─────────

export async function signUp(email: string, password: string): Promise<void> {
  const { user } = await api<{ user: Account }>("POST", "/auth/signup", {
    email,
    password,
    locale: getLocale(),
  });
  enter(user);
}

export async function signIn(email: string, password: string): Promise<void> {
  const { user } = await api<{ user: Account }>("POST", "/auth/login", { email, password });
  enter(user);
}

/** Signs out and clears this device; the games stay in the account. */
export async function signOut(): Promise<void> {
  clearTimeout(pushTimer);
  await pushGames().catch(() => {}); // last moves, if any; signing out matters more
  await api("POST", "/auth/logout");
  leave();
  forgetGames();
}

export async function updateAccount(changes: {
  displayName?: string;
  email?: string;
  /** Needed to change the e-mail. */
  currentPassword?: string;
}): Promise<void> {
  const { user } = await api<{ user: Account }>("PATCH", "/me", changes);
  if (state.status === "user") setState({ status: "user", account: user });
}

/** Also signs the account out on every other device. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api("PUT", "/me/password", { currentPassword, newPassword });
}

/** Deletes the account and its games, on the server and on this device. */
export async function deleteAccount(password: string): Promise<void> {
  await api("DELETE", "/me", { password });
  leave();
  forgetGames();
}
