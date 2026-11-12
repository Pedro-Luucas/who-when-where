// Settings come from the environment; see deploy/api.env.example.

import type { Vapid } from "./push.ts";

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
  /** Web Push keys (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT); push is off without them. */
  vapid?: Vapid | null;
  /**
   * Enforce the plans (PRO_GATING=on): 402 upgrade_required for features an
   * account lacks, the practice allowance, party seats by the host's plan.
   * Off by default: everything stays free. See plans.ts and shared/plans.ts.
   */
  proGating?: boolean;
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
    vapid:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? {
            publicKey: env.VAPID_PUBLIC_KEY.trim(),
            privateKey: env.VAPID_PRIVATE_KEY.trim(),
            subject: env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com",
          }
        : null,
    proGating: env.PRO_GATING === "on" || env.PRO_GATING === "1",
  };
}
