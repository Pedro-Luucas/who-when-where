"use client";

import { useMemo, useState } from "react";
import type { Locale, Localized } from "@/lib/i18n";

// The Name engine's input: type a few letters, pick from the matches — any
// list of things with names in both languages (people, countries, cities).
// Typing down to one match is as good as tapping it; the arrow keys move the
// choice; Enter only submits a choice the player made or typed out in full.

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

const SHOWN = 8;

/** Names one item of `pool`. */
export function NamePicker({ pool, locale, taken, onSubmit, labels, children, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<string | null>(null);

  const found = useMemo(() => searchNames(query, pool, locale), [query, pool, locale]);
  // The names already given are taken out before the list is cut, so they never crowd out valid matches.
  const open = found.filter((item) => !taken.has(item.id));
  const matches = [...open, ...found.filter((item) => taken.has(item.id))].slice(0, SHOWN);
  const chosen = choice && open.some((item) => item.id === choice) ? choice : null;
  const picked = chosen ?? open[0]?.id ?? null;
  const typed = fold(query);
  const sure =
    chosen !== null ||
    open.length === 1 ||
    (open[0] !== undefined && typed !== "" && fold(open[0].name[locale]) === typed);

  function submit() {
    if (!picked || !sure || disabled) return;
    onSubmit(picked);
    setQuery("");
    setChoice(null);
  }

  function move(step: number) {
    if (!open.length) return;
    const at = chosen ? open.findIndex((item) => item.id === chosen) : step > 0 ? -1 : 0;
    setChoice(open[(at + step + open.length) % open.length].id);
  }

  return (
    <form
      className="picker"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        className="picker-input"
        type="search"
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setChoice(null);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
        }}
        placeholder={labels.placeholder}
        aria-label={labels.search}
        autoComplete="off"
        spellCheck={false}
      />
      {query.trim() !== "" && (
        <ul className="picker-list">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={taken.has(item.id)}
                aria-pressed={picked === item.id}
                onClick={() => setChoice(item.id)}
              >
                {item.name[locale]}
                {item.note && <small className="picker-note">{item.note}</small>}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="picker-empty">{labels.noMatch}</li>}
        </ul>
      )}
      <div className="picker-actions">
        {children ?? <span />}
        <button type="submit" className="button" disabled={!picked || !sure || disabled}>
          {labels.submit}
        </button>
      </div>
    </form>
  );
}
