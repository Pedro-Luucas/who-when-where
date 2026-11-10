// Request bodies are untrusted JSON. Each reader returns a clean value or
// throws an Invalid naming the field.

export class Invalid extends Error {
  field: string;
  constructor(field: string) {
    super(`Invalid ${field}`);
    this.field = field;
  }
}

export const LOCALES = ["en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export const DISPLAY_NAME_MAX = 40;

export const MAX_SAVES_PER_REQUEST = 200;
const MAX_RECORD_BYTES = 4096;
const MAX_DAY = 100_000;
const MAX_PROGRESS = 1000;

export function asObject(value: unknown, field = "body"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Invalid(field);
  return value as Record<string, unknown>;
}

export function readEmail(value: unknown): string {
  if (typeof value !== "string") throw new Invalid("email");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Invalid("email");
  return email;
}

/** A password being chosen. Length is the only rule. */
export function readNewPassword(value: unknown, field = "password"): string {
  if (typeof value !== "string" || value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    throw new Invalid(field);
  }
  return value;
}

/** A password being checked: anything that could have been chosen, or older. */
export function readPassword(value: unknown, field = "password"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > PASSWORD_MAX) {
    throw new Invalid(field);
  }
  return value;
}

export function readDisplayName(value: unknown): string {
  if (typeof value !== "string") throw new Invalid("displayName");
  const name = value.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
  if ([...name].length > DISPLAY_NAME_MAX) throw new Invalid("displayName");
  return name;
}

export function readLocale(value: unknown): Locale {
  if (!LOCALES.includes(value as Locale)) throw new Invalid("locale");
  return value as Locale;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const AVATARS = 8;

/** A public handle: 3–20 of a-z, 0-9 and _. Upper case is folded. */
export function readUsername(value: unknown, field = "username"): string {
  if (typeof value !== "string") throw new Invalid(field);
  const username = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) throw new Invalid(field);
  return username;
}

export function readAvatar(value: unknown): number {
  return readInteger(value, 0, AVATARS - 1, "avatar");
}

/** One line of text typed by a player (a name, a chat message): tidied, 1 to `max` characters. */
export function readLine(value: unknown, max: number, field: string, allowEmpty = false): string {
  if (typeof value !== "string") throw new Invalid(field);
  const line = value.replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  const length = [...line].length;
  if (length > max || (length === 0 && !allowEmpty)) throw new Invalid(field);
  return line;
}

export const MESSAGE_MAX = 500;
export const PARTY_NAME_MAX = 40;

/** The games that keep scores (the site's games/slugs.ts lists the same). */
export const GAMES = ["who-when-where", "wayfarer", "dig-site", "first-to-last", "overland", "outline"] as const;
export type Game = (typeof GAMES)[number];

export const isGame = (value: unknown): value is Game => GAMES.includes(value as Game);

/** The most a puzzle is worth, in any game. */
export const MAX_POINTS = 1000;
const DETAIL_MAX = 40;

export type ResultInput = { game: Game; day: number; points: number; detail: string };

export function readResults(value: unknown, latestDay: number): ResultInput[] {
  if (!Array.isArray(value) || value.length > MAX_SAVES_PER_REQUEST) throw new Invalid("results");
  return value.map((item) => {
    const result = asObject(item, "results");
    if (!isGame(result.game)) throw new Invalid("results.game");
    return {
      game: result.game,
      day: readInteger(result.day, 1, latestDay, "results.day"),
      points: readInteger(result.points, 0, MAX_POINTS, "results.points"),
      detail: result.detail === undefined ? "" : readLine(result.detail, DETAIL_MAX, "results.detail", true),
    };
  });
}

// ── Parties ────────────────────────────────────────────────────────────────

export const PARTY_ORDERS = ["grouped", "alternate", "shuffle"] as const;
export const PARTY_PACES = ["free", "together"] as const;
export const PARTY_TIME_LIMITS = [0, 60, 90, 120, 180, 300];
export const MAX_ROUNDS_PER_GAME = 5;

/** How a party plays; the site's expedition/settings.ts is the same shape. */
export type PartySettings = {
  /** Puzzles of each game; 0 leaves the game out. */
  rounds: Record<Game, number>;
  order: (typeof PARTY_ORDERS)[number];
  /** Seconds per puzzle; 0 for no clock. */
  timeLimit: number;
  /**
   * Tries per puzzle: digs in Dig Site, guesses in Wayfarer and Outline,
   * attempts in First to Last, guesses to spare in Overland.
   */
  digs: number;
  guesses: number;
  attempts: number;
  spare: number;
  /** "together": nobody moves on until everyone has finished the puzzle. */
  pace: (typeof PARTY_PACES)[number];
};

/** Spare guesses in Overland when the settings don't say. */
const DEFAULT_SPARE = 4;

export function readPartySettings(value: unknown): PartySettings {
  const input = asObject(value, "settings");
  const rounds = asObject(input.rounds, "settings.rounds");
  const settings: PartySettings = {
    // A game the sender has not heard of (a page loaded before it existed) is left out.
    rounds: Object.fromEntries(
      GAMES.map((game) => [
        game,
        rounds[game] === undefined ? 0 : readInteger(rounds[game], 0, MAX_ROUNDS_PER_GAME, "settings.rounds"),
      ]),
    ) as Record<Game, number>,
    order: readChoice(input.order, PARTY_ORDERS, "settings.order"),
    timeLimit: readInteger(input.timeLimit, 0, 300, "settings.timeLimit"),
    digs: readInteger(input.digs, 3, 6, "settings.digs"),
    guesses: readInteger(input.guesses, 3, 6, "settings.guesses"),
    attempts: readInteger(input.attempts, 1, 4, "settings.attempts"),
    spare: input.spare === undefined ? DEFAULT_SPARE : readInteger(input.spare, 1, 5, "settings.spare"),
    pace: readChoice(input.pace, PARTY_PACES, "settings.pace"),
  };
  if (!PARTY_TIME_LIMITS.includes(settings.timeLimit)) throw new Invalid("settings.timeLimit");
  if (stageCount(settings) < 1) throw new Invalid("settings.rounds");
  return settings;
}

/** Puzzles in one run of a party. */
export const stageCount = (settings: PartySettings): number =>
  GAMES.reduce((sum, game) => sum + settings.rounds[game], 0);

/**
 * A party's settings as they were stored, made whole: a party opened before
 * a game existed plays none of it.
 */
export function storedPartySettings(json: string): PartySettings {
  const stored = JSON.parse(json) as PartySettings;
  return {
    ...stored,
    rounds: Object.fromEntries(GAMES.map((game) => [game, stored.rounds[game] ?? 0])) as Record<Game, number>,
    spare: stored.spare ?? DEFAULT_SPARE,
  };
}

export function readChoice<const T extends readonly string[]>(value: unknown, choices: T, field: string): T[number] {
  if (typeof value !== "string" || !choices.includes(value)) throw new Invalid(field);
  return value;
}

export type SaveInput = { game: string; day: number; progress: number; record: string };

export function readInteger(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Invalid(field);
  }
  return value;
}

export function readSaves(value: unknown): SaveInput[] {
  if (!Array.isArray(value) || value.length > MAX_SAVES_PER_REQUEST) throw new Invalid("saves");
  return value.map((item) => {
    const save = asObject(item, "saves");
    if (typeof save.game !== "string" || !/^[a-z0-9-]{1,40}$/.test(save.game)) throw new Invalid("saves.game");
    const record = JSON.stringify(asObject(save.record, "saves.record"));
    if (Buffer.byteLength(record) > MAX_RECORD_BYTES) throw new Invalid("saves.record");
    return {
      game: save.game,
      day: readInteger(save.day, 1, MAX_DAY, "saves.day"),
      progress: readInteger(save.progress, 0, MAX_PROGRESS, "saves.progress"),
      record,
    };
  });
}
