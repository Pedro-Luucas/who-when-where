import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { deleteOldMessages } from "./chat.ts";
import { loadConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { deleteStaleParties } from "./parties.ts";
import { createPusher } from "./push.ts";
import { RateLimiter } from "./rate-limit.ts";
import { remindStreaks } from "./reminders.ts";
import { deleteExpiredSessions } from "./sessions.ts";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const limiter = new RateLimiter();
const pusher = createPusher(db, config.vapid ?? null);
const app = createApp(db, config, limiter, pusher);

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`API listening on http://${info.address}:${info.port} (database: ${config.databasePath})`);
});

function tidy(): void {
  deleteExpiredSessions(db);
  deleteStaleParties(db);
  deleteOldMessages(db);
  limiter.sweep();
}
tidy();
const tidying = setInterval(tidy, 15 * 60_000);

// Streak reminders go out late in the UTC day; checking every 5 minutes is plenty.
function remind(): void {
  remindStreaks(db, pusher).catch((error: unknown) => console.warn("reminders failed:", error));
}
const reminding = setInterval(remind, 5 * 60_000);

function shutdown(): void {
  clearInterval(tidying);
  clearInterval(reminding);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Don't let an idle keep-alive connection hold the process open.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
