import { api } from "@/account/api";
import type { ExpeditionSettings } from "@/expedition/settings";
import type { GameSlug } from "@/games/slugs";

// The community side of the accounts API (api/src/social.ts, chat.ts and
// parties.ts): what it returns, and one function per call.

/** What players see of each other. Never an e-mail address. */
export type PublicUser = {
  id: string;
  username: string;
  /** The name to show. */
  name: string;
  /** Which avatar colour they picked. */
  avatar: number;
  online: boolean;
};

/** How the viewer stands with another player. */
export type Relation = "self" | "friends" | "incoming" | "outgoing" | "none";

export type ChatMessage = { id: number; at: number; body: string; user: PublicUser };

// ── Leaderboards and profiles ───────────────────────────────────────────────

export type Period = "day" | "week" | "all";
export type Scope = "all" | "friends";
export type Standing = { rank: number; points: number; puzzles: number };
export type Leaderboard = {
  players: number;
  rows: (Standing & { user: PublicUser })[];
  /** The viewer's own standing, when signed in and on the board. */
  me: Standing | null;
};

export function getLeaderboard(query: { day: number; period: Period; scope: Scope; game: GameSlug | "all" }) {
  const params = new URLSearchParams({ ...query, day: String(query.day) });
  return api<Leaderboard>("GET", `/leaderboard?${params}`);
}

export type DayActivity = { day: number; puzzles: number; points: number };
export type Profile = {
  user: PublicUser;
  joinedAt: number;
  /** null when nobody is signed in. */
  relation: Relation | null;
  stats: { points: number; puzzles: number; days: number; fullDays: number; streak: number; longest: number };
  games: { game: GameSlug; played: number; points: number; best: number }[];
  activity: DayActivity[];
};

export const getProfile = (username: string) => api<Profile>("GET", `/players/${encodeURIComponent(username)}`);

export const searchPlayers = (query: string) =>
  api<{ players: { user: PublicUser; relation: Relation }[] }>("GET", `/players?q=${encodeURIComponent(query)}`);

/** Sends finished daily puzzles to the leaderboards. */
export const putResults = (results: { game: GameSlug; day: number; points: number; detail: string }[]) =>
  api("PUT", "/results", { results });

// ── Friends ─────────────────────────────────────────────────────────────────

export type Friends = {
  friends: { user: PublicUser; today: { points: number; puzzles: number } | null }[];
  /** Players who asked the viewer. */
  incoming: PublicUser[];
  /** Players the viewer asked. */
  outgoing: PublicUser[];
};

export const getFriends = (day: number) => api<Friends>("GET", `/friends?day=${day}`);
export const addFriend = (username: string) => api<{ relation: Relation }>("POST", "/friends", { username });
export const acceptFriend = (userId: string) => api<{ relation: Relation }>("POST", `/friends/${userId}/accept`);
/** Also declines a request, or takes one back. */
export const removeFriend = (userId: string) => api("DELETE", `/friends/${userId}`);

export type Invite = { code: string; name: string; from: PublicUser };
export type Pulse = {
  /** Friend requests waiting for an answer. */
  requests: number;
  /** Unread direct messages, by who sent them. */
  unread: { userId: string; count: number }[];
  invites: Invite[];
};

export const getPulse = () => api<Pulse>("GET", "/pulse");

// ── Chat ────────────────────────────────────────────────────────────────────

/** A room: everybody's, or the one shared with a friend. (A party's chat comes with the party.) */
export type Room = { kind: "global" } | { kind: "dm"; userId: string };

const roomPath = (room: Room) => (room.kind === "global" ? "/chat/global" : `/chat/dm/${room.userId}`);

export const getMessages = (room: Room, after?: number) =>
  api<{ messages: ChatMessage[] }>("GET", `${roomPath(room)}${after === undefined ? "" : `?after=${after}`}`);

export const sendMessage = (room: Room, body: string) =>
  api<{ message: ChatMessage }>("POST", roomPath(room), { body });

// ── Parties ─────────────────────────────────────────────────────────────────

export type Visibility = "public" | "private";

export type PartyInfo = {
  code: string;
  name: string;
  hostId: string;
  visibility: Visibility;
  settings: ExpeditionSettings;
  status: "lobby" | "playing";
  /** Counts the runs played; each start is a new one. */
  run: number;
  seed: string;
  startedAt: number;
  /** Playing "together": the last puzzle the host stopped waiting on. */
  released: number;
};

export type PartyMember = {
  user: PublicUser;
  /** Their page is open on the room. */
  here: boolean;
  /** Came in mid-run: watching until the next one. */
  spectator: boolean;
  /** One score per puzzle finished in this run. */
  results: { points: number; detail: string }[];
};

export type PartyState = {
  /** The viewer's own id. */
  you: string;
  party: PartyInfo;
  members: PartyMember[];
  /** The room's chat since the last call. */
  messages: ChatMessage[];
};

export type PartySummary = {
  code: string;
  name: string;
  status: "lobby" | "playing";
  visibility: Visibility;
  players: number;
  stages: number;
  host: PublicUser;
};

export const listParties = () => api<{ mine: PartySummary[]; open: PartySummary[] }>("GET", "/parties");

export const createParty = (input: { name: string; settings: ExpeditionSettings; visibility: Visibility }) =>
  api<PartyState>("POST", "/parties", input);

export const joinParty = (code: string) => api<PartyState>("POST", "/parties/join", { code });

export const getParty = (code: string, after?: number) =>
  api<PartyState>("GET", `/parties/${code}${after === undefined ? "" : `?after=${after}`}`);

export const updateParty = (
  code: string,
  changes: { name?: string; settings?: ExpeditionSettings; visibility?: Visibility },
) => api<PartyState>("PATCH", `/parties/${code}`, changes);

export const startParty = (code: string) => api<PartyState>("POST", `/parties/${code}/start`);
export const reopenLobby = (code: string) => api<PartyState>("POST", `/parties/${code}/lobby`);
export const releaseStage = (code: string, stage: number) =>
  api<PartyState>("POST", `/parties/${code}/release`, { stage });
export const kickMember = (code: string, userId: string) =>
  api<PartyState>("POST", `/parties/${code}/kick`, { userId });

export const postPartyResult = (
  code: string,
  result: { run: number; stage: number; points: number; detail: string },
) => api("POST", `/parties/${code}/results`, result);

export const sendPartyMessage = (code: string, body: string) =>
  api<{ message: ChatMessage }>("POST", `/parties/${code}/chat`, { body });

export const leaveParty = (code: string) => api("POST", `/parties/${code}/leave`);
export const inviteToParty = (code: string, userId: string) => api("POST", `/parties/${code}/invite`, { userId });
export const declineInvite = (code: string) => api("POST", `/parties/${code}/decline`);
