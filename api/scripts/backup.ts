// Writes a consistent copy of the database next to it (backups/app-<date>.db)
// and deletes copies older than KEEP_DAYS. Safe to run while the API is up.
//
//   DATABASE_PATH=/var/lib/who-when-where/app.db node scripts/backup.ts

import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = process.env.DATABASE_PATH ?? "data/app.db";
const keepDays = Number(process.env.KEEP_DAYS ?? 14);
const directory = join(dirname(databasePath), "backups");
mkdirSync(directory, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(directory, `app-${stamp}.db`);

const db = new DatabaseSync(databasePath, { readOnly: true });
db.prepare("VACUUM INTO ?").run(target);
db.close();
console.log(`Backed up to ${target}`);

const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
for (const name of readdirSync(directory)) {
  const file = join(directory, name);
  if (/^app-.*\.db$/.test(name) && statSync(file).mtimeMs < cutoff) {
    rmSync(file);
    console.log(`Removed ${file}`);
  }
}
