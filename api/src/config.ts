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
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production";
  return {
    host: env.HOST ?? "127.0.0.1",
    port: Number(env.PORT ?? 4310),
    databasePath: env.DATABASE_PATH ?? "data/app.db",
    secureCookies: production,
    trustProxy: env.TRUST_PROXY === "1",
  };
}
