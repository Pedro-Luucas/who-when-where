import { randomInt, randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { Failure, isUniqueViolation, transaction, type Deps, type Env } from "./http.ts";
import { requireUsername } from "./people.ts";
import { LIMITS } from "./rate-limit.ts";
import { Invalid } from "./validate.ts";

// A finished party can be played again: the host opens a new lobby with the
// same expedition settings. The old room stays as it is. party/room.tsx calls
// this through social/rematch.ts (`rematchParty`).

// No 0/O, 1/I/L: codes get read aloud. The same alphabet as parties.ts.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

const newCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

type PartyRow = { id: string; code: string; host_id: string; name: string; visibility: string; settings: string };

export function registerRematch(account: Hono<Env>, { db, limit }: Deps): void {
  /**
   * Copies a party's expedition settings into a new open lobby the host owns.
   * Only the host of `code` may do it.
   */
  account.post("/parties/:code/rematch", (c) => {
    const user = requireUsername(c.get("user"));
    limit(`parties:${user.id}`, LIMITS.partiesPerUser);
    const raw = c.req.param("code");
    if (raw.length < 1 || raw.length > 16) throw new Invalid("code");
    const party = db
      .prepare("SELECT id, code, host_id, name, visibility, settings FROM parties WHERE code = ?")
      .get(raw.toUpperCase()) as PartyRow | undefined;
    if (!party) throw new Failure(404, "no_such_party");
    if (party.host_id !== user.id) throw new Failure(403, "not_host");

    const now = Date.now();
    const id = randomUUID();
    const visibility = party.visibility === "public" ? "public" : "private";
    for (let attempt = 0; ; attempt++) {
      const code = newCode();
      try {
        transaction(db, () => {
          db.prepare(
            `INSERT INTO parties (id, code, host_id, name, visibility, settings, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'lobby', ?, ?)`,
          ).run(id, code, user.id, party.name, visibility, party.settings, now, now);
          db.prepare("INSERT INTO party_members (party_id, user_id, joined_at, last_seen) VALUES (?, ?, ?, ?)").run(
            id,
            user.id,
            now,
            now,
          );
        });
        return c.json({ code, name: party.name }, 201);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= 5) throw error;
      }
    }
  });
}
