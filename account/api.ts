// Client for the accounts API (the service in /api). Pages call it on their
// own origin under /api; next.config.ts forwards those requests to the server
// named by API_ORIGIN, so the session cookie stays first-party.

/** A failed call. `code` is the API's error name, or "network" / "unavailable". */
export class ApiError extends Error {
  code: string;
  status: number;
  /** For code "invalid": the field that was refused. */
  field?: string;

  constructor(code: string, status: number, field?: string) {
    super(code);
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
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
    const { error, field } = data as { error?: string; field?: string };
    throw new ApiError(error ?? "unavailable", response.status, field);
  }
  return data as T;
}
