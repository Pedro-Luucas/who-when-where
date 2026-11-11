// Settings come from the environment; see deploy/api.env.example.

export type Config = {
  host: string;
  port: number;
  /** SQLite file, or ":memory:". */
  databasePath: string;
  /** Mark the session cookie Secure (HTTPS only). */
  secureCookies: boolean;
  /** Take the client address from X-Forwarded-For (set when behind Caddy). */
  trustProxy: boolean;
  /**
   * A header holding the real visitor's address, for when a CDN in front of the proxy
   * (the Vercel rewrite) hides it: e.g. "x-vercel-forwarded-for". Only set it when the
   * API is reachable through that CDN alone, since any client can forge a header.
   */
  clientIpHeader?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production";
  return {
    host: env.HOST ?? "127.0.0.1",
    port: Number(env.PORT ?? 4310),
    databasePath: env.DATABASE_PATH ?? "data/app.db",
    secureCookies: production,
    trustProxy: env.TRUST_PROXY === "1",
    clientIpHeader: env.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined,
  };
}
