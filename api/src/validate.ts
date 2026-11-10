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

export type SaveInput = { game: string; day: number; progress: number; record: string };

function readInteger(value: unknown, min: number, max: number, field: string): number {
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
