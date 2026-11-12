import { api } from "@/account/api";
import { normalizeSettings, wireSettings, type ExpeditionSettings } from "@/expedition/settings";
import type { GameSlug } from "@/games/registry";

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
  /** ISO 3166-1 alpha-2, when they chose to show one (an API from before countries leaves it out). */
  country?: string | null;
};

/** How the viewer stands with another player. */
export type Relation = "self" | "friends" | "incoming" | "outgoing" | "none";

export type ChatMessage = { id: number; at: number; body: string; user: PublicUser };

// ── Leaderboards and profiles ───────────────────────────────────────────────

export type Period = "day" | "week" | "all";
export type Scope = "all" | "friends" | "country";
export type Standing = { rank: number; points: number; puzzles: number };
export type Leaderboard = {
  players: number;
  rows: (Standing & { user: PublicUser })[];
  /** The viewer's own standing, when signed in and on the board. */
  me: Standing | null;
};

export function getLeaderboard(query: { day: number; period: Period; scope: Scope; game: GameSlug | "all"; country?: string }) {
  const { country, ...rest } = query;
  const params = new URLSearchParams({ ...rest, day: String(query.day), ...(country ? { country } : {}) });
  return api<Leaderboard>("GET", `/leaderboard?${params}`);
}

export type DayActivity = { day: number; puzzles: number; points: number };
export type Profile = {
  user: PublicUser;
  joinedAt: number;
  /** null when nobody is signed in. */
  relation: Relation | null;
  /** A friends-only profile seen by someone who is not a friend: only `user`, `joinedAt` and `relation` come with it. */
  private?: boolean;
  /** The league tier they last played in (0 Bronze … 4 Diamond); null if never. */
  leagueTier?: number | null;
  /** `freezes`: held now (an API from before freezes leaves it out). */
  stats: { points: number; puzzles: number; days: number; fullDays: number; streak: number; longest: number; freezes?: number };
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
  /** Unread notifications in the inbox (an API from before the inbox leaves it out). */
  notifications?: number;
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
  /** How many players the room holds, from its host's plan (an API from before plans leaves it out: 12). */
  seats?: number;
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

/**
 * A party's state as the pages use it. The settings come back in whatever
 * shape the API of the day keeps them (see wireSettings): here they are made
 * whole, so the rest of the site only ever sees one.
 */
const party = (state: Promise<PartyState>): Promise<PartyState> =>
  state.then((current) =>
    current?.party
      ? { ...current, party: { ...current.party, settings: normalizeSettings(current.party.settings) } }
      : current,
  );

export const createParty = (input: { name: string; settings: ExpeditionSettings; visibility: Visibility }) =>
  party(api<PartyState>("POST", "/parties", { ...input, settings: wireSettings(input.settings) }));

export const joinParty = (code: string) => party(api<PartyState>("POST", "/parties/join", { code }));

export const getParty = (code: string, after?: number) =>
  party(api<PartyState>("GET", `/parties/${code}${after === undefined ? "" : `?after=${after}`}`));

/** Changes a party. `before` is the settings the party has now, when new ones are sent (see wireSettings). */
export const updateParty = (
  code: string,
  changes: { name?: string; settings?: ExpeditionSettings; visibility?: Visibility },
  before?: ExpeditionSettings,
) =>
  party(
    api<PartyState>("PATCH", `/parties/${code}`, {
      ...changes,
      ...(changes.settings ? { settings: wireSettings(changes.settings, before) } : {}),
    }),
  );

export const startParty = (code: string) => party(api<PartyState>("POST", `/parties/${code}/start`));
export const reopenLobby = (code: string) => party(api<PartyState>("POST", `/parties/${code}/lobby`));
export const releaseStage = (code: string, stage: number) =>
  party(api<PartyState>("POST", `/parties/${code}/release`, { stage }));
export const kickMember = (code: string, userId: string) =>
  party(api<PartyState>("POST", `/parties/${code}/kick`, { userId }));

export const postPartyResult = (
  code: string,
  result: { run: number; stage: number; points: number; detail: string },
) => api("POST", `/parties/${code}/results`, result);

export const sendPartyMessage = (code: string, body: string) =>
  api<{ message: ChatMessage }>("POST", `/parties/${code}/chat`, { body });

export const leaveParty = (code: string) => api("POST", `/parties/${code}/leave`);
export const inviteToParty = (code: string, userId: string) => api("POST", `/parties/${code}/invite`, { userId });
export const declineInvite = (code: string) => api("POST", `/parties/${code}/decline`);
