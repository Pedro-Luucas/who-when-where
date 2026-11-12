import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Schema changes are appended here and never edited: a database remembers how
// many it has applied (PRAGMA user_version) and runs the rest on startup.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,   -- trimmed and lower-cased
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    locale        TEXT NOT NULL DEFAULT 'en',
    created_at    INTEGER NOT NULL,       -- all times are ms since the epoch
    updated_at    INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,          -- SHA-256 of the cookie value
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE INDEX sessions_expiry ON sessions(expires_at);

  -- One row per puzzle a player has started: the game's own record, as JSON.
  -- "progress" only ever grows, so a stale device cannot undo a newer one.
  CREATE TABLE saves (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game       TEXT NOT NULL,
    day        INTEGER NOT NULL,
    progress   INTEGER NOT NULL,
    record     TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, game, day)
  ) STRICT, WITHOUT ROWID;
  `,

  // The community: public handles, scores, friends, chat and parties.
  `
  ALTER TABLE users ADD COLUMN username TEXT;                     -- a-z, 0-9 and _; null until chosen
  ALTER TABLE users ADD COLUMN avatar INTEGER NOT NULL DEFAULT 0; -- index of the avatar colour
  ALTER TABLE users ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
  CREATE UNIQUE INDEX users_username ON users(username) WHERE username IS NOT NULL;

  -- A finished daily puzzle's score, 0-1000 whatever the game. The first
  -- score sent for a day stands.
  CREATE TABLE results (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game       TEXT NOT NULL,
    day        INTEGER NOT NULL,
    points     INTEGER NOT NULL,
    detail     TEXT NOT NULL DEFAULT '',  -- the short result as shown to players, e.g. "3/6"
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, game, day)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX results_day ON results(day, game);

  -- One row per pair of players, ids in order (low < high).
  CREATE TABLE friendships (
    low        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    high       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester  TEXT NOT NULL,             -- who asked: low or high
    status     TEXT NOT NULL,             -- 'pending' | 'accepted'
    created_at INTEGER NOT NULL,
    PRIMARY KEY (low, high)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX friendships_high ON friendships(high);

  -- Chat. A channel is 'global', 'dm:<low>:<high>' or 'party:<party id>'.
  CREATE TABLE messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel    TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id      TEXT REFERENCES users(id) ON DELETE CASCADE,  -- the other player, in a direct message
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX messages_channel ON messages(channel, id);
  CREATE INDEX messages_to ON messages(to_id, id) WHERE to_id IS NOT NULL;

  -- How far a player has read each direct conversation.
  CREATE TABLE chat_reads (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    last_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, channel)
  ) STRICT, WITHOUT ROWID;

  -- A party: a room where a group plays the same expedition. Each start is a
  -- new "run" with a new seed; clients deal the puzzles from the seed.
  CREATE TABLE parties (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,      -- what players type to join
    host_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL,             -- 'public' (listed) | 'private' (code or invitation)
    settings   TEXT NOT NULL,             -- JSON, see readPartySettings
    status     TEXT NOT NULL,             -- 'lobby' | 'playing'
    run        INTEGER NOT NULL DEFAULT 0,
    seed       TEXT NOT NULL DEFAULT '',
    started_at INTEGER NOT NULL DEFAULT 0,
    released   INTEGER NOT NULL DEFAULT -1, -- last stage the host stopped waiting on
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE party_members (
    party_id  TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    PRIMARY KEY (party_id, user_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX party_members_user ON party_members(user_id);

  CREATE TABLE party_results (
    party_id   TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    run        INTEGER NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage      INTEGER NOT NULL,
    points     INTEGER NOT NULL,
    detail     TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (party_id, run, user_id, stage)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE party_invites (
    party_id   TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- who is invited
    from_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (party_id, user_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX party_invites_user ON party_invites(user_id);
  `,
  // 2: players the host removed from a room cannot walk back in.
  `
  CREATE TABLE party_bans (
    party_id   TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (party_id, user_id)
  ) STRICT, WITHOUT ROWID;
  `,
  // 3: social v2 — privacy, country, invitations, challenges, the inbox,
  // push notifications, weekly leagues and the Weekly Special.
  `
  ALTER TABLE users ADD COLUMN profile_visibility TEXT NOT NULL DEFAULT 'public'; -- 'public' | 'friends'
  ALTER TABLE users ADD COLUMN hide_presence INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN country TEXT;                 -- ISO 3166-1 alpha-2, only if the player sets it
  ALTER TABLE users ADD COLUMN invited_by TEXT REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE users ADD COLUMN league_tier INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN reminded_day INTEGER NOT NULL DEFAULT 0; -- last day a streak reminder went out
  CREATE INDEX users_country ON users(country) WHERE country IS NOT NULL;

  -- A challenge: an expedition (seed + settings) someone played and dares
  -- others to beat. Open to anyone with the link, or sent to one friend.
  CREATE TABLE challenges (
    id         TEXT PRIMARY KEY,           -- what the link carries: /c/<id>
    from_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id      TEXT REFERENCES users(id) ON DELETE CASCADE,  -- a duel sent to one friend
    reply_to   TEXT,                       -- the challenge this one answers (a rematch)
    seed       TEXT NOT NULL,
    settings   TEXT NOT NULL,              -- JSON, the party settings' shape
    created_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX challenges_from ON challenges(from_id, created_at);
  CREATE INDEX challenges_to ON challenges(to_id, created_at) WHERE to_id IS NOT NULL;

  -- Everyone's score on a challenge, the sender's included. The first one stands.
  CREATE TABLE challenge_entries (
    challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points       INTEGER NOT NULL,
    results      TEXT NOT NULL,            -- JSON: [{ points, detail }] per puzzle
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (challenge_id, user_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX challenge_entries_user ON challenge_entries(user_id, created_at);

  -- The inbox: what happened to a player while they were away.
  CREATE TABLE notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,              -- see notify.ts
    actor_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
    ref        TEXT NOT NULL DEFAULT '',   -- a challenge id, when there is one
    points     INTEGER,
    created_at INTEGER NOT NULL,
    read_at    INTEGER
  ) STRICT;
  CREATE INDEX notifications_user ON notifications(user_id, id);

  -- Web Push: one row per browser that agreed to get notifications.
  CREATE TABLE push_subscriptions (
    endpoint   TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);

  -- Weekly leagues: each week a player who scores is put in a group of up to
  -- 30 at their tier; the top of a group goes up a tier, the bottom down.
  CREATE TABLE league_members (
    week      INTEGER NOT NULL,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier      INTEGER NOT NULL,
    grp       INTEGER NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (week, user_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX league_groups ON league_members(week, tier, grp);

  -- The Weekly Special: one run per player per week. The first score stands.
  CREATE TABLE weekly_results (
    week       INTEGER NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points     INTEGER NOT NULL,
    results    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (week, user_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX weekly_results_points ON weekly_results(week, points);
  `,
];

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  const { user_version: applied } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  for (let version = applied; version < MIGRATIONS.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
