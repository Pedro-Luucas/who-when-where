"use client";

import { useId, useState } from "react";
import { cn } from "./cn";

// The answer field of every game where a guess is typed: a country (Outline,
// Overland, Border Chain…), a person (Clue Ladder, Life Tracks), a journey
// (Wayfarer), a river. It is the Combobox of the UI kit (combobox.tsx) — the
// same WAI-ARIA combobox and listbox, the same keys — shaped as a game's
// picker: a form with the field, the matches and the game's own keys
// (Guess, Skip, Step back…) under it.
//
//   type a few letters → the matches open (names that start with the text first)
//   ↓ ↑               → move through them (the field keeps the focus)
//   Enter             → guess the highlighted one; with none highlighted, only
//                       the one match left or a name typed out in full, so a
//                       stray Enter after one letter never wastes a guess
//   a tap on a match  → choose it; a second tap on it guesses
//   Esc               → close the list, then clear the field

export type GuessOption = {
  id: string;
  label: string;
  /** A second line under the name: "1809–1882", "composer". */
  note?: string;
  /** Already guessed: listed, struck through, not choosable. */
  taken?: boolean;
};

type Props = {
  /** Every option that matches `query`, best first (taken ones included). */
  search: (query: string) => GuessOption[];
  /** With an empty field, the list the field offers on focus (Wayfarer's whole logbook). */
  browse?: () => GuessOption[];
  /** The option a text names exactly, if any: typing a name out in full makes it the guess. */
  exact?: (query: string) => string | undefined;
  onSubmit: (id: string) => void;
  labels: { placeholder: string; search: string; submit: string; noMatch: string };
  /** Extra keys, left of the submit key (Skip, Step back). */
  children?: React.ReactNode;
  disabled?: boolean;
  /** How many matches to list when searching. */
  max?: number;
  className?: string;
  actionsClassName?: string;
};

export function GuessCombobox({
  search,
  browse,
  exact,
  onSubmit,
  labels,
  children,
  disabled,
  max = 8,
  className,
  actionsClassName,
}: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [closed, setClosed] = useState(false);

  const typed = query.trim() !== "";
  const browsing = !typed && !!browse && focused;
  const found = typed ? search(query) : browsing ? browse() : [];
  // Taken options go after the open ones before the list is cut, so they never crowd out a valid match.
  const open = found.filter((option) => !option.taken);
  const matches = [...open, ...found.filter((option) => option.taken)].slice(0, typed ? max : undefined);
  const active = chosen && open.some((option) => option.id === chosen) ? chosen : null;
  const exactId = typed && exact ? exact(query) : undefined;
  const sure = active ?? (typed && open.length === 1 ? open[0].id : null) ?? (open.some((o) => o.id === exactId) ? exactId! : null);
  const shown = (typed || browsing) && !closed;
  const activeIndex = active ? matches.findIndex((option) => option.id === active) : -1;

  function submit(pick = sure) {
    if (!pick || disabled) return;
    onSubmit(pick);
    setQuery("");
    setChosen(null);
  }

  function move(step: number) {
    if (!open.length) return;
    setClosed(false);
    // From an unchosen list the first press lands on the first (or last) match.
    const at = active ? open.findIndex((option) => option.id === active) : step > 0 ? -1 : 0;
    setChosen(open[(at + step + open.length) % open.length].id);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Escape") {
      if (shown && (active || typed)) {
        event.preventDefault();
        setClosed(true);
        setChosen(null);
      } else if (typed) {
        event.preventDefault();
        setQuery("");
      }
    }
  }

  return (
    <form
      className={cn("picker", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        className="picker-input"
        type="search"
        role="combobox"
        aria-label={labels.search}
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown && activeIndex >= 0 ? `${id}-${activeIndex}` : undefined}
        value={query}
        disabled={disabled}
        enterKeyHint="go"
        onChange={(event) => {
          setQuery(event.target.value);
          setChosen(null);
          setClosed(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={labels.placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <ul id={`${id}-list`} className="picker-list" role="listbox" aria-label={labels.search} hidden={!shown}>
        {matches.map((option, index) => (
          <li
            key={option.id}
            id={`${id}-${index}`}
            role="option"
            className="picker-option"
            aria-selected={option.id === active}
            aria-disabled={option.taken || undefined}
            // The field keeps the focus (and the phone its keyboard) while a finger picks.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (option.taken) return;
              if (option.id === active) submit(option.id);
              else setChosen(option.id);
            }}
          >
            {option.label}
            {option.note && <small className="picker-note">{option.note}</small>}
          </li>
        ))}
        {matches.length === 0 && (
          <li className="picker-empty" role="presentation">
            {labels.noMatch}
          </li>
        )}
      </ul>
      <div className={cn("picker-actions", actionsClassName)}>
        {children ?? <span />}
        <button type="submit" className="button" disabled={!sure || disabled}>
          {labels.submit}
        </button>
      </div>
    </form>
  );
}
