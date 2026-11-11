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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A check for a game's save: `{ days: { [day]: record } }`, where each record
 * keeps its moves in the `progressField` list (and, for a game that names more
 * lists, each of `lists`). Anything else is not trusted to be played on.
 */
export function saveShape(progressField: string, ...lists: string[]) {
  return (value: unknown): boolean => {
    if (!isObject(value) || !isObject(value.days)) return false;
    return Object.values(value.days).every(
      (record) =>
        isObject(record) &&
        [progressField, ...lists].every((field) => Array.isArray(record[field])),
    );
  };
}
