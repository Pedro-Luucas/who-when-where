import { api } from "@/account/api";
import { normalizeSettings, wireSettings, type ExpeditionSettings } from "@/expedition/settings";
import type { PublicUser, Relation } from "./client";

// Social v2 on the accounts API (api/src/challenges.ts, notify.ts, leagues.ts):
// challenges, the inbox, push subscriptions, leagues and the Weekly Special.
// Every call fails with an ApiError ("not_found" from an API that predates
// them); the pages built on them say so instead of breaking.

// ── Challenges ──────────────────────────────────────────────────────────────

export type StageScore = { points: number; detail: string };

export type ChallengeEntry = { user: PublicUser; points: number; results: StageScore[]; at: number };

export type Challenge = {
  id: string;
  from: PublicUser;
  /** The friend a duel was sent to. */
  to: PublicUser | null;
  replyTo: string | null;
  seed: string;
  settings: ExpeditionSettings;
  stages: number;
  createdAt: number;
  /** Best first. */
  entries: ChallengeEntry[];
  players: number;
  mine: ChallengeEntry | null;
  relation: Relation | null;
};

const whole = (answer: Promise<{ challenge: Challenge }>) =>
  answer.then(({ challenge }) => ({ ...challenge, settings: normalizeSettings(challenge.settings) }));

export const getChallenge = (id: string) => whole(api("GET", `/challenges/${encodeURIComponent(id)}`));

export const createChallenge = (input: {
  seed: string;
  settings: ExpeditionSettings;
  results: StageScore[];
  /** A friend's username: sends it to them as a duel. */
  to?: string;
  /** The challenge this one answers. */
  replyTo?: string;
}) => whole(api("POST", "/challenges", { ...input, settings: wireSettings(input.settings) }));

export const enterChallenge = (id: string, results: StageScore[]) =>
  whole(api("POST", `/challenges/${encodeURIComponent(id)}/entries`, { results }));

export type ChallengeSummary = {
  id: string;
  from: PublicUser;
  to: PublicUser | null;
  createdAt: number;
  players: number;
  /** The viewer's score; null until they play it. */
  mine: number | null;
  best: number;
};

export const listChallenges = () => api<{ challenges: ChallengeSummary[] }>("GET", "/challenges");

// ── The inbox ───────────────────────────────────────────────────────────────

export type NotificationKind = "challenge" | "challenge_played" | "friend_request" | "friend_accepted" | "invite_joined";

export type Notice = {
  id: number;
  kind: NotificationKind;
  at: number;
  read: boolean;
  user: PublicUser | null;
  ref: string;
  points: number | null;
};

export type Conversation = { user: PublicUser; last: { body: string; at: number; mine: boolean }; unread: number };

export type Inbox = { notifications: Notice[]; unread: number; conversations: Conversation[] };

export const getInbox = () => api<Inbox>("GET", "/inbox");
export const markInboxRead = () => api("POST", "/inbox/read");

// ── Push ────────────────────────────────────────────────────────────────────

export const getPushKey = () => api<{ key: string }>("GET", "/push/key");
export const savePushSubscription = (subscription: PushSubscriptionJSON) => api("PUT", "/push", subscription);
export const deletePushSubscription = (endpoint: string) => api("DELETE", "/push", { endpoint });
export const sendTestPush = () => api("POST", "/push/test");

// ── Leagues ─────────────────────────────────────────────────────────────────

export type LeagueRow = {
  rank: number;
  points: number;
  puzzles: number;
  user: PublicUser;
  /** "up": in the promotion zone; "down": relegation. */
  zone: "up" | "down" | null;
};

export type LeagueOutcome = {
  week: number;
  tier: number;
  rank: number;
  size: number;
  outcome: "up" | "down" | "stay";
  newTier: number;
};

export type League = {
  week: number;
  endsAt: number;
  tiers: string[];
  /** The player's tier this week (or the one they will start at). */
  tier: number;
  /** null until they score a daily this week. */
  group: { number: number; promote: number; demote: number; rows: LeagueRow[] } | null;
  /** How last week ended, if they played it. */
  last: LeagueOutcome | null;
};

export const getLeague = () => api<League>("GET", "/league");

// ── The Weekly Special ──────────────────────────────────────────────────────

export type WeeklyBoard = {
  week: number;
  endsAt: number;
  players: number;
  rows: { rank: number; points: number; user: PublicUser }[];
  me: { rank: number; points: number; results: StageScore[] } | null;
};

export const getWeeklyBoard = (week: number) => api<WeeklyBoard>("GET", `/weekly?week=${week}`);
export const putWeekly = (week: number, results: StageScore[]) => api("PUT", "/weekly", { week, results });
