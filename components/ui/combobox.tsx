"use client";

import { useId, useState } from "react";
import { cn } from "./cn";

export type ComboOption = {
  value: string;
  label: string;
  /** A second line or a note at the end of the row. */
  hint?: string;
  /** Shown struck through and not choosable (e.g. a country already named). */
  disabled?: boolean;
};

type ComboboxProps = {
  /** The visible label above the input. */
  label: string;
  options: readonly ComboOption[];
  onSelect: (option: ComboOption) => void;
  placeholder?: string;
  /** Shown when nothing matches. */
  emptyText: string;
  /** How many matches to list at most. */
  max?: number;
  /** Clears the input after a choice (the default), for pickers that take several answers. */
  clearOnSelect?: boolean;
  className?: string;
};

/** Lower case, without accents: "São Tomé" matches "sao tome". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Choosable matches first (names that start with the query before the rest), then the disabled ones; then cut. */
export function matchOptions(options: readonly ComboOption[], query: string, max: number): ComboOption[] {
  const q = fold(query);
  if (!q) return [];
  const hits = options.filter((option) => fold(option.label).includes(q));
  const rank = (option: ComboOption) => (option.disabled ? 2 : fold(option.label).startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => rank(a) - rank(b)).slice(0, max);
}

/**
 * A WAI-ARIA combobox with a listbox popup: type to filter, arrows to move,
 * Enter to choose. Enter only chooses a highlighted option, or the one option
 * left, so a stray Enter after one letter never wastes a guess.
 */
export function Combobox({ label, options, onSelect, placeholder, emptyText, max = 8, clearOnSelect = true, className }: ComboboxProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const matches = matchOptions(options, query, max);
  const choosable = matches.filter((option) => !option.disabled);
  const shown = open && query.trim() !== "";
  const activeOption = active >= 0 ? matches[active] : undefined;

  function choose(option: ComboOption | undefined) {
    if (!option || option.disabled) return;
    onSelect(option);
    setQuery(clearOnSelect ? "" : option.label);
    setActive(-1);
    setOpen(false);
  }

  function move(step: number) {
    if (!choosable.length) return;
    let next = active;
    for (let i = 0; i < matches.length; i++) {
      next = (next + step + matches.length) % matches.length;
      if (!matches[next].disabled) break;
    }
    setActive(next);
    setOpen(true);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(activeOption ?? (choosable.length === 1 ? choosable[0] : undefined));
    } else if (event.key === "Escape") {
      if (shown) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else setQuery("");
    }
  }

  return (
    <div className={cn("relative grid gap-1.5", className)}>
      <label htmlFor={`${id}-input`} className="font-mono text-xs font-semibold tracking-[0.08em] text-fg-2 uppercase">
        {label}
      </label>
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown && activeOption ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="min-h-11 w-full rounded-md border border-line-strong bg-sunken px-3.5 text-base text-fg shadow-[inset_0_2px_4px_rgb(0_0_0/0.18)] placeholder:text-fg-3 focus-visible:border-accent"
      />
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        hidden={!shown}
        className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-line-strong bg-surface p-1 shadow-raised"
      >
        {matches.length === 0 ? (
          <li role="presentation" className="px-3 py-2.5 text-sm text-fg-2">
            {emptyText}
          </li>
        ) : (
          matches.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              aria-disabled={option.disabled || undefined}
              // Keep focus in the input while the pointer picks.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              onMouseMove={() => !option.disabled && setActive(index)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-base",
                index === active && "bg-accent-soft text-fg shadow-[inset_2px_0_0_var(--accent)]",
                option.disabled && "cursor-default text-fg-3 line-through",
              )}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.hint && <span className="shrink-0 font-mono text-xs text-fg-3">{option.hint}</span>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
