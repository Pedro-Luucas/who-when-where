// Gives an account Pro by hand (testing, comps), or takes it back. There is
// no payment integration: this is the only way onto Pro for now.
//
//   DATABASE_PATH=/var/lib/who-when-where/app.db node scripts/grant-pro.ts <username|email> [days|forever|off]
//
//   ... ada 30        Pro for 30 days from now
//   ... ada forever   Pro with no end (the default)
//   ... ada off       back to Free
//
// Takes effect on the player's next page load (GET /me). Safe while the API runs.

import { openDatabase } from "../src/db.ts";

const [who, length = "forever"] = process.argv.slice(2);
if (!who) {
  console.error("Usage: node scripts/grant-pro.ts <username|email> [days|forever|off]");
  process.exit(1);
}

const db = openDatabase(process.env.DATABASE_PATH ?? "data/app.db");
const user = db
  .prepare("SELECT id, username, email FROM users WHERE username = ? OR email = ?")
  .get(who.toLowerCase(), who.trim().toLowerCase()) as { id: string; username: string | null; email: string } | undefined;
if (!user) {
  console.error(`No account named ${who}.`);
  process.exit(1);
}

const name = user.username ? `@${user.username}` : user.email;
const now = Date.now();
if (length === "off") {
  db.prepare("UPDATE users SET plan = 'free', plan_expires_at = NULL, updated_at = ? WHERE id = ?").run(now, user.id);
  console.log(`${name} is on Free.`);
} else {
  const days = length === "forever" ? null : Number(length);
  if (days !== null && (!Number.isFinite(days) || days <= 0)) {
    console.error("The length is a number of days, 'forever' or 'off'.");
    process.exit(1);
  }
  const expiresAt = days === null ? null : now + Math.round(days * 24 * 60 * 60 * 1000);
  db.prepare("UPDATE users SET plan = 'pro', plan_expires_at = ?, updated_at = ? WHERE id = ?").run(expiresAt, now, user.id);
  console.log(`${name} is on Pro ${expiresAt === null ? "with no end" : `until ${new Date(expiresAt).toISOString()}`}.`);
}
db.close();
