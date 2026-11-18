import { api } from "@/account/api";

/**
 * Opens a new lobby with the same expedition settings as the party `code`.
 * The caller must be that party's host. The old room is left as it is.
 *
 * party/room.tsx should call this when the race is over, for the host only,
 * then send the room to the new code:
 *
 *     const { code: next } = await rematchParty(party.code);
 *     router.push(`/party?code=${next}`);
 */
export function rematchParty(code: string): Promise<{ code: string; name: string }> {
  return api("POST", `/parties/${encodeURIComponent(code)}/rematch`);
}
