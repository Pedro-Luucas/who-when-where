"use client";

import { GATING, LIMITS, type Feature, type GatingMode, type Limits, type PlanId } from "@/shared/plans";
import { useAccount } from "./state";

// What the player's plan allows, for the page to show (AUDIT_AND_PLAN §7.4,
// soft gates). The API stays the authority: it says which plan an account is
// on (GET /me) and refuses with 402 what it enforces itself.
//
// While the switch in shared/plans.ts is off (the default), `has` says yes to
// everything and `showPro` is false: the site looks and plays as it always did.

export type Entitlements = {
  /** This build's switch: off, preview or on. */
  gating: GatingMode;
  /** Pro chips, the pricing pill and plan cards are shown (preview or on). */
  showPro: boolean;
  /** guest (not signed in), free or pro. */
  plan: PlanId;
  /** Still asking the server who is signed in: treat nothing as locked or unlocked yet. */
  loading: boolean;
  /** When Pro ends (ms); null for no end, or not on Pro. */
  planExpiresAt: number | null;
  /** Whether a gate is open. Always true unless gating is on. */
  has: (feature: Feature) => boolean;
  /** Whether the plan itself includes a feature, whatever the switch (for upsell hints in preview). */
  owns: (feature: Feature) => boolean;
  /** The plan's numbers (practice allowance, archive window, party seats). */
  limits: Limits;
  /** Practice puzzles the server counted today (signed in, newer API). */
  practiceToday: number;
};

export function useEntitlements(): Entitlements {
  const state = useAccount();
  const loading = state.status === "loading";
  const server = state.status === "user" ? state.entitlements : null;
  const plan: PlanId = state.status === "user" ? (server?.plan ?? "free") : "guest";
  const features = new Set<Feature>(plan === "pro" ? [] : (server?.features ?? []));
  return {
    gating: GATING,
    showPro: GATING !== "off",
    plan,
    loading,
    planExpiresAt: server?.planExpiresAt ?? null,
    has: (feature) => GATING !== "on" || plan === "pro" || features.has(feature),
    owns: (feature) => plan === "pro" || features.has(feature),
    limits: server?.limits ?? LIMITS[plan],
    practiceToday: server?.usageToday.practice ?? 0,
  };
}

/**
 * How many past days of the archive the player may play: null for all of
 * them (Pro, or gating off), 0 for none (guests with gating on).
 */
export function archiveWindow(entitlements: Entitlements): number | null {
  if (entitlements.gating !== "on" || entitlements.has("archive.all")) return null;
  return entitlements.limits.archiveDays;
}
