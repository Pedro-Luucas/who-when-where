import type { DatabaseSync } from "node:sqlite";
import type { Context } from "hono";
import type { Limit } from "./rate-limit.ts";
import type { UserRow } from "./sessions.ts";

// What every group of routes shares: the request context, the error the
// client is expected to handle, and the helpers app.ts hands to each group.

export type Env = { Variables: { user: UserRow; token: string } };

/** An error the client is expected to handle; `code` is part of the API. */
export class Failure extends Error {
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429;
  code: string;
  retryAfter?: number;
  constructor(status: Failure["status"], code: string, retryAfter?: number) {
    super(code);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export type Deps = {
  db: DatabaseSync;
  /** Counts one attempt against a rate limit; throws a 429 Failure when over. */
  limit(key: string, rule: Limit): void;
  /** The request's JSON body, as an object. */
  body(c: Context): Promise<Record<string, unknown>>;
  /** The signed-in account, when the request carries a valid session. */
  viewer(c: Context): UserRow | null;
};

export const isUniqueViolation = (error: unknown) =>
  error instanceof Error && error.message.includes("UNIQUE constraint failed");

/** Runs `work` in a transaction. */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
