"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { readDailyResults, useDailyResults, type DailyResult } from "@/games/results";
import { countMoves } from "@/games/saves";
import { CHALLENGE_SLUGS, inChallenge } from "@/games/registry";
import { useDayNumber } from "@/lib/clock";
import { confetti, cue, cuePuzzle, heardVerdict, type Cue } from "@/lib/fx";
import { readStore, subscribeToStore, writeStore } from "@/lib/storage";
import { toast } from "@/lib/toasts";
import { standingsOf } from "./achievements";
import { levelOf } from "./level";
import { useLogbookT, type LogbookKey } from "./messages";

// Watches the games saved on the device and answers what happens in them: a
// tick for a move, a fanfare and confetti for a puzzle well finished, a notice
// for an achievement earned or a level gained. Mounted once, in the root
// layout, so no game has to know about any of it.

/** What the player has already been told: achievement ids, and their level. */
type Told = { achievements: string[]; level: number } | null;
const TOLD_KEY = "logbook:told";

const keyOf = (result: DailyResult) => `${result.game}:${result.day}`;
const totalOf = (results: DailyResult[]) => results.reduce((sum, result) => sum + result.points, 0);

/** The HUD pips last sounded, so a save from another device does not replay them. */
let pipsSeen = "";

/**
 * The verdict of the try just locked, read off the HUD pips, when the plaque
 * did not already sound it (Wayfarer and First to Last never set a tone).
 * A move that arrived on its own — a save from another device — is not a tap,
 * and stays a plain tick.
 */
function freshVerdict(): Cue | undefined {
  const nodes = [...document.querySelectorAll("main.game .hud-pips li")];
  if (!nodes.length) {
    pipsSeen = "";
    return undefined;
  }
  const states = nodes.map((pip) => pip.getAttribute("data-state") ?? "");
  const signature = states.join(",");
  const changed = signature !== pipsSeen;
  pipsSeen = signature;
  if (!changed || heardVerdict()) return undefined;
  if (navigator.userActivation && !navigator.userActivation.isActive) return undefined;
  const last = [...states].reverse().find((state) => state && state !== "todo" && state !== "current");
  if (last === "hit" || last === "near" || last === "miss") return last;
  return undefined;
}

export function Celebrations() {
  const { t } = useLogbookT();
  const today = useDayNumber();
  const results = useDailyResults();
  const moves = useSyncExternalStore(subscribeToStore, countMoves, () => 0);
  const seen = useRef<{ keys: Set<string>; moves: number } | null>(null);

  // Moves and finished puzzles.
  useEffect(() => {
    const before = seen.current;
    // The first look only takes stock, straight from the device: what was
    // played before this page opened is not news.
    if (!before) {
      seen.current = { keys: new Set(readDailyResults().map(keyOf)), moves: countMoves() };
      return;
    }
    seen.current = { keys: new Set(results.map(keyOf)), moves };
    // One move at a time is the player's own; anything else is games arriving
    // from their account, played on another device.
    if (moves - before.moves !== 1) return;

    const finished = results.filter((result) => result.day === today && !before.keys.has(keyOf(result)));
    const verdict = freshVerdict();
    if (finished.length !== 1) return cue(verdict ?? "move");
    const [result] = finished;
    // The try that ended the puzzle still gets its own hit or miss; the
    // fanfare follows it (cue holds a win back a moment when a verdict just played).
    if (verdict) cue(verdict);
    // The last of the day's dailies gets the lot, whatever it scored: the whole day is done.
    // (The other games' daily puzzles are extras and never finish a day.)
    const dayDone =
      inChallenge(result.game) &&
      new Set(results.filter((entry) => entry.day === today && inChallenge(entry.game)).map((entry) => entry.game)).size ===
        CHALLENGE_SLUGS.length;
    if (dayDone) {
      cue("great");
      confetti(3);
    } else cuePuzzle(result.points, result.detail.startsWith("X"));
  }, [results, moves, today]);

  // Achievements and levels.
  useEffect(() => {
    if (today < 1) return;
    const told = readStore<Told>(TOLD_KEY, null);
    const earned = standingsOf(results, today)
      .filter((standing) => standing.unlocked)
      .map((standing) => standing.achievement);
    const { level, rank } = levelOf(totalOf(results));
    const fresh = earned.filter((achievement) => !told?.achievements.includes(achievement.id));
    const levelled = told !== null && level > told.level;
    if (!fresh.length && !levelled && told) return;

    writeStore<Told>(TOLD_KEY, {
      achievements: [...new Set([...(told?.achievements ?? []), ...earned.map((achievement) => achievement.id)])],
      level,
    });
    // A device seeing its first games (a new player, or an account just
    // signed into) starts from where things stand, without a notice for each.
    if (!told && results.length > 1) return;

    if (levelled) {
      toast({
        mark: String(level),
        title: t("levelUp", { n: level }),
        body: t("levelUpBody", { rank: t(`rank${rank}` as LogbookKey) }),
        href: "/logbook",
      });
    }
    if (fresh.length > 2) {
      toast({
        mark: String(fresh.length),
        title: t("unlockedMany", { n: fresh.length }),
        body: t("unlockedManyBody"),
        href: "/logbook",
      });
    } else {
      for (const achievement of fresh) {
        toast({
          mark: achievement.mark,
          title: t(`ach_${achievement.id}` as LogbookKey),
          body: t("unlocked"),
          href: "/logbook",
        });
      }
    }
    // After the puzzle's own fanfare, not on top of it.
    if (fresh.length || levelled) setTimeout(() => cue("unlock"), 900);
  }, [results, today, t]);

  return null;
}
