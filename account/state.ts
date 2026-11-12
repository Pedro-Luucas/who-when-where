"use client";

import { useSyncExternalStore } from "react";
import { getLocale, setLocale, type Locale } from "@/lib/i18n";
import { readStore, subscribeToStore, writeStore } from "@/lib/storage";
import type { Feature, Limits } from "@/shared/plans";
import { forgetResults, pushResults } from "@/social/results";
import { ApiError, api } from "./api";
import { forgetGames, pushGames, syncGames } from "./sync";

// Who is signed in. The session itself is an HttpOnly cookie that scripts
// cannot see, so the state lives here: asked from the server once per visit,
// then kept in step by the actions below.

export type Account = {
  id: string;
  email: string;
  /** The public handle other players add and see; null until the player picks one. */
  username: string | null;
  /** May be empty. */
  displayName: string;
  /** Which avatar colour the player picked. */
  avatar: number;
  locale: Locale;
  createdAt: number;
  /** Who may see the profile (an API from before privacy settings leaves these three out). */
  profileVisibility?: "public" | "friends";
  /** Others never see the player online. */
  hidePresence?: boolean;
  /** ISO 3166-1 alpha-2 flag shown on the profile; null for none. */
  country?: string | null;
};

/**
 * What the account's plan allows, as the API tells it (GET /me). An API from
 * before plans sends none: the account is then taken to be on Free.
 */
export type ServerEntitlements = {
  plan: "free" | "pro";
  planExpiresAt: number | null;
  features: Feature[];
  limits: Limits;
  usageToday: { practice: number };
  /** The API refuses what the plan does not include (its PRO_GATING switch). */
  gating: boolean;
};

export type AccountState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "user"; account: Account; entitlements: ServerEntitlements | null };

type SignedIn = { user: Account; entitlements?: ServerEntitlements };

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
    const { user, entitlements } = await api<SignedIn>("GET", "/me");
    enter(user, entitlements);
  } catch (error) {
    endIfSignedOut(error);
    setState(GUEST);
  } finally {
    restoring = false;
  }
}

function enter(account: Account, entitlements?: ServerEntitlements): void {
  // The account's language wins on this device. Set it before the state, or
  // onStoreChange would read the difference as the player picking a language.
  if (getLocale() !== account.locale) setLocale(account.locale);
  setState({ status: "user", account, entitlements: entitlements ?? null });
  writeStore(SIGNED_IN_KEY, true);
  syncGames(account.id)
    .then(() => pushResults(account.id))
    .catch(endIfSignedOut);
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
    setState({ ...state, account: { ...state.account, locale } });
    api("PATCH", "/me", { locale }).catch(endIfSignedOut);
  }

  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (state.status !== "user") return;
    const { id } = state.account;
    pushGames()
      .then(() => pushResults(id))
      .catch(endIfSignedOut);
  }, PUSH_DELAY_MS);
}

// ── Actions. Each rejects with an ApiError when the server refuses. ─────────

/** The handle of the friend whose invitation link brought this visitor (social/invite-page.tsx). */
export const INVITED_BY_KEY = "account:invited-by";

export async function signUp(email: string, password: string, username: string): Promise<void> {
  const invitedBy = readStore<string | null>(INVITED_BY_KEY, null);
  const { user, entitlements } = await api<SignedIn>("POST", "/auth/signup", {
    email,
    password,
    username,
    locale: getLocale(),
    ...(invitedBy ? { invitedBy } : {}),
  });
  writeStore(INVITED_BY_KEY, null);
  enter(user, entitlements);
}

export async function signIn(email: string, password: string): Promise<void> {
  const { user, entitlements } = await api<SignedIn>("POST", "/auth/login", { email, password });
  enter(user, entitlements);
}

/** Signs out and clears this device; the games stay in the account. */
export async function signOut(): Promise<void> {
  clearTimeout(pushTimer);
  await pushGames().catch(() => {}); // last moves, if any; signing out matters more
  await api("POST", "/auth/logout");
  leave();
  forgetGames();
  forgetResults();
}

export async function updateAccount(changes: {
  username?: string;
  avatar?: number;
  displayName?: string;
  email?: string;
  /** Needed to change the e-mail. */
  currentPassword?: string;
  profileVisibility?: "public" | "friends";
  hidePresence?: boolean;
  country?: string | null;
}): Promise<void> {
  const { user } = await api<{ user: Account }>("PATCH", "/me", changes);
  if (state.status === "user") setState({ ...state, account: user });
}

/** Asks the server again what the account's plan allows (after a purchase, a grant, a 402). */
export async function refreshEntitlements(): Promise<void> {
  if (state.status !== "user") return;
  try {
    const { user, entitlements } = await api<SignedIn>("GET", "/me");
    if (state.status === "user") setState({ ...state, account: user, entitlements: entitlements ?? null });
  } catch (error) {
    endIfSignedOut(error);
  }
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
  forgetResults();
}
