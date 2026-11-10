import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { RateLimiter } from "./rate-limit.ts";
import { deleteExpiredSessions } from "./sessions.ts";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const limiter = new RateLimiter();
const app = createApp(db, config, limiter);

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`API listening on http://${info.address}:${info.port} (database: ${config.databasePath})`);
});

function tidy(): void {
  deleteExpiredSessions(db);
  limiter.sweep();
}
tidy();
const tidying = setInterval(tidy, 15 * 60_000);

function shutdown(): void {
  clearInterval(tidying);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Don't let an idle keep-alive connection hold the process open.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
