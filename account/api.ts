// Client for the accounts API (the service in /api). Pages call it on their
// own origin under /api; next.config.ts forwards those requests to the server
// named by API_ORIGIN, so the session cookie stays first-party.

/** A failed call. `code` is the API's error name, or "network" / "unavailable". */
export class ApiError extends Error {
  code: string;
  status: number;
  /** For code "invalid": the field that was refused. */
  field?: string;
  /** For code "upgrade_required" (402): the plan feature that was missing (shared/plans.ts). */
  feature?: string;

  constructor(code: string, status: number, field?: string, feature?: string) {
    super(code);
    this.code = code;
    this.status = status;
    this.field = field;
    this.feature = feature;
  }
}

/**
 * Called when the API answers 402 upgrade_required, whichever call it was:
 * the Pro sheet listens (components/pro/pro-sheet.tsx), so the client and the
 * server cannot disagree on what is gated without the player hearing of it.
 */
export const upgradeListeners = new Set<(feature: string | undefined) => void>();

/**
 * Calls the API. A 402 opens the Pro sheet unless `quiet` (a call made in the
 * middle of a puzzle: upsells never interrupt play).
 */
export async function api<T = void>(method: string, path: string, body?: unknown, quiet = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError("network", 0);
  }

  if (response.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    // Not our API talking: it is down, or API_ORIGIN is not set.
    throw new ApiError("unavailable", response.status);
  }
  if (!response.ok) {
    const { error, field, feature } = data as { error?: string; field?: string; feature?: string };
    if (response.status === 402 && !quiet) upgradeListeners.forEach((listener) => listener(feature));
    throw new ApiError(error ?? "unavailable", response.status, field, feature);
  }
  return data as T;
}
