"use client";

import { GuessCombobox } from "@/components/ui/guess-combobox";
import type { Locale, Localized } from "@/lib/i18n";

// The Name engine's input: type a few letters, pick from the matches — any
// list of things with names in both languages (people, countries, cities).
// Typing down to one match is as good as tapping it; the arrow keys move the
// choice; Enter only submits a choice the player made or typed out in full
// (components/ui/guess-combobox.tsx).

export type Nameable = {
  id: string;
  name: Localized;
  /** Other names a player may type: "USA", a maiden name, an old name. */
  also?: readonly string[];
  /** A short line under the name in the list: "1809–1882", "Nigeria". */
  note?: string;
};

/** "Côte d'Ivoire" matches "cote d ivoire". */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The items a typed name could mean, best match first: names that start with
 * the text, then names with a word that does, then names that contain it.
 */
export function searchNames<T extends Nameable>(query: string, pool: readonly T[], locale: Locale): T[] {
  const text = fold(query);
  if (!text) return [];
  const ranked: { item: T; rank: number }[] = [];
  for (const item of pool) {
    const own = fold(item.name[locale]);
    const keys = [own, fold(item.name.en), fold(item.name.pt), ...(item.also ?? []).map(fold)];
    const rank = own.startsWith(text)
      ? 0
      : keys.some((key) => key.startsWith(text))
        ? 1
        : keys.some((key) => key.includes(` ${text}`))
          ? 2
          : keys.some((key) => key.includes(text))
            ? 3
            : -1;
    if (rank >= 0) ranked.push({ item, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.item.name[locale].localeCompare(b.item.name[locale], locale))
    .map((entry) => entry.item);
}

/** The one item a typed text names exactly (any of its names), if there is one. */
export function exactName<T extends Nameable>(query: string, pool: readonly T[]): T | undefined {
  const text = fold(query);
  if (!text) return undefined;
  return pool.find((item) => [item.name.en, item.name.pt, ...(item.also ?? [])].some((name) => fold(name) === text));
}

type Props = {
  pool: readonly Nameable[];
  locale: Locale;
  /** Already named: listed, but struck through. */
  taken: ReadonlySet<string>;
  onSubmit: (id: string) => void;
  labels: { placeholder: string; search: string; submit: string; noMatch: string };
  /** Extra actions, left of the submit button. */
  children?: React.ReactNode;
  disabled?: boolean;
};

/** Names one item of `pool`: the game's GuessCombobox, fed by searchNames. */
export function NamePicker({ pool, locale, taken, onSubmit, labels, children, disabled }: Props) {
  return (
    <GuessCombobox
      search={(query) =>
        searchNames(query, pool, locale).map((item) => ({
          id: item.id,
          label: item.name[locale],
          note: item.note,
          taken: taken.has(item.id),
        }))
      }
      exact={(query) => exactName(query, pool)?.id}
      onSubmit={onSubmit}
      labels={labels}
      disabled={disabled}
    >
      {children}
    </GuessCombobox>
  );
}
