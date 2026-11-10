/**
 * What account sync needs to know about a game's save. Every game stores
 * `{ days: { [day]: record } }` under `key`, and a day's record holds a list
 * that grows with each move (`progressField`): the longer list is the newer save.
 */
export type SyncedSave = {
  /** The game's slug; names its rows on the server. */
  game: string;
  /** The save's key in lib/storage. */
  key: string;
  progressField: string;
};
