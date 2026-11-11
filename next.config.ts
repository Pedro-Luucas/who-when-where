import type { NextConfig } from "next";

// Where the accounts API (the service in /api) runs. Pages call it as /api/…
// on their own origin and Next forwards the request, so the session cookie is
// first-party. Read when the app is built: set API_ORIGIN before `next build`.
const apiOrigin =
  process.env.API_ORIGIN ?? (process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:4310");

// The six games that had an address of their own before every game moved
// under /play. Links to them are out there (shared results, bookmarks, the
// installed app's history), so they keep working. Later games never had one.
const GAMES_ONCE_AT_ROOT = ["who-when-where", "wayfarer", "dig-site", "first-to-last", "overland", "outline"];

const nextConfig: NextConfig = {
  async rewrites() {
    return apiOrigin ? [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }] : [];
  },
  async redirects() {
    return GAMES_ONCE_AT_ROOT.map((slug) => ({ source: `/${slug}`, destination: `/play/${slug}`, permanent: true }));
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
