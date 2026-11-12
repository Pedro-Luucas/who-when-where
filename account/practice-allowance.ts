"use client";

import { useCallback } from "react";
import { useDayNumber } from "@/lib/clock";
import { usePersistent } from "@/lib/storage";
import { UNLIMITED_PRACTICE_GAMES } from "@/shared/plans";
import { ApiError, api } from "./api";
import { useEntitlements } from "./entitlements";

// The practice allowance (AUDIT_AND_PLAN §7.2): with gating on, guests get a
// few practice puzzles a day and free accounts more, the classic games
// unlimited; Pro has no limit. A puzzle counts when its first move is made.
//
// Counted on the device for everyone, and by the API for accounts
// (POST /practice/start), which is the authority: its count wins when higher.
// An API from before plans answers 404, and the device's count is used alone.

type Usage = { day: number; count: number };

const KEY = "practice-usage:v1";
const NONE: Usage = { day: 0, count: 0 };
const isUsage = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Usage).day === "number" &&
  typeof (value as Usage).count === "number";

type Ticket = { metered: boolean; used: number; limit: number | null; remaining: number | null };

export type PracticeAllowance = {
  /** This game's practice counts against an allowance for this player. */
  metered: boolean;
  /** The day's allowance; null when unlimited. */
  limit: number | null;
  /** Puzzles left today; null when unlimited. */
  remaining: number | null;
  /** Today's allowance is used up (never true while the account is still loading). */
  locked: boolean;
  /** Counts a puzzle the player has just started. */
  take: () => void;
};

export function usePracticeAllowance(game: string): PracticeAllowance {
  const entitlements = useEntitlements();
  const day = useDayNumber();
  const [usage, setUsage] = usePersistent<Usage>(KEY, NONE, isUsage);
  const signedIn = entitlements.plan !== "guest";
  const classic = (UNLIMITED_PRACTICE_GAMES as readonly string[]).includes(game);
  const metered =
    entitlements.gating === "on" &&
    !entitlements.loading &&
    !entitlements.has("practice.unlimited") &&
    !(signedIn && classic) &&
    entitlements.limits.practicePerDay !== null;
  const limit = metered ? entitlements.limits.practicePerDay : null;
  const used = Math.max(usage.day === day ? usage.count : 0, entitlements.practiceToday);
  const remaining = limit === null ? null : Math.max(0, limit - used);

  const take = useCallback(() => {
    if (!metered || !day) return;
    const counted = (count: number) =>
      setUsage((previous) => ({ day, count: Math.max(count, previous.day === day ? previous.count : 0) }));
    setUsage((previous) => ({ day, count: (previous.day === day ? previous.count : 0) + 1 }));
    if (!signedIn) return;
    api<Ticket>("POST", "/practice/start", { game }, true)
      .then((ticket) => ticket.metered && counted(ticket.used))
      .catch((error) => {
        // Out of allowance by the server's count (another device): this puzzle
        // goes on, the next one will not. Anything else leaves the device's count.
        if (error instanceof ApiError && error.status === 402 && limit !== null) counted(limit);
      });
  }, [metered, day, signedIn, game, limit, setUsage]);

  return { metered, limit, remaining, locked: remaining === 0, take };
}
