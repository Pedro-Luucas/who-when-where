// Reading the accounts API from the server (Open Graph cards), where the
// browser's /api rewrite does not apply. Same origin as next.config.ts uses.
// Public data only; anything that fails resolves to null, so a card can still
// be drawn without it.

const origin = () => process.env.API_ORIGIN || process.env.API_ORIGIN_BUILT || undefined;

export async function readPublicApi<T>(path: string): Promise<T | null> {
  const base = origin();
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** A handle as it may appear in a URL: 3–20 of a-z, 0-9 and _. */
export const cleanHandle = (value: string): string | null => {
  const handle = decodeURIComponent(value).trim().toLowerCase();
  return /^[a-z0-9_]{3,20}$/.test(handle) ? handle : null;
};
