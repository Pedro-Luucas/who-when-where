import type { NextConfig } from "next";

// Where the accounts API (the service in /api) runs. Pages call it as /api/…
// on their own origin and Next forwards the request, so the session cookie is
// first-party. Read when the app is built: set API_ORIGIN before `next build`.
const apiOrigin =
  process.env.API_ORIGIN ?? (process.env.NODE_ENV === "production" ? undefined : "http://127.0.0.1:4310");

const nextConfig: NextConfig = {
  async rewrites() {
    return apiOrigin ? [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }] : [];
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
