// ┌──────────────────────────────────────────────────────────────────────────┐
// │ THE DAILIES — the games that make up "today", every day.                 │
// └──────────────────────────────────────────────────────────────────────────┘
//
// The set does not rotate: it is these games, in this order, every day. Only
// the puzzle inside each one changes, at 00:00 UTC (lib/daily.ts).
//
// The list drives the dailies strip and the /daily page, the "n/5 done today"
// ring, the day's share card, the next-up trail after a result, the streak
// (a day counts once one of these is finished: lib/streak.ts), the activity
// graph and the "All games" leaderboards.
//
// To change it, edit DAILY_SET below — slugs from games/registry.ts — and the
// accounts API's copy, DAILY_SET in api/src/validate.ts (its tests fail until
// the two match). Every other game keeps a daily puzzle of its own, on its
// page, plus unlimited practice.

export const DAILY_SET = ["who-when-where", "wayfarer", "dig-site", "first-to-last", "outline"] as const;

/**
 * How many past days the archive calendar on /daily offers to play. Archive
 * puzzles are kept on the device and count for nothing (no streak, no
 * leaderboard), like practice. The future Pro plan widens this (§7.2).
 */
export const ARCHIVE_DAYS = 28;
