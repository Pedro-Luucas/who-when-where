"use client";

import { useState } from "react";
import { searchCountries, type Country } from "@/lib/countries";
import { useLocale } from "@/lib/i18n";

type Props = {
  /** The countries that can be named. */
  pool: readonly Country[];
  /** Already named: listed, but struck through. */
  taken: ReadonlySet<string>;
  onSubmit: (id: string) => void;
  labels: { placeholder: string; search: string; submit: string; noMatch: string };
  /** Extra actions, left of the submit button (e.g. "Skip"). */
  children?: React.ReactNode;
};

const SHOWN = 8;

/**
 * Names a country: type a few letters, pick from the matches. Typing down to
 * a single country is as good as tapping it; the arrow keys move the choice.
 */
export function CountryPicker({ pool, taken, onSubmit, labels, children }: Props) {
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<string | null>(null);

  const matches = searchCountries(query, pool, locale).slice(0, SHOWN);
  const open = matches.filter((country) => !taken.has(country.id));
  const picked = choice && open.some((country) => country.id === choice) ? choice : (open[0]?.id ?? null);

  function submit() {
    if (!picked) return;
    onSubmit(picked);
    setQuery("");
    setChoice(null);
  }

  function move(step: number) {
    if (!open.length) return;
    const at = open.findIndex((country) => country.id === picked);
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
          {matches.map((country) => (
            <li key={country.id}>
              <button
                type="button"
                disabled={taken.has(country.id)}
                aria-pressed={picked === country.id}
                onClick={() => setChoice(country.id)}
              >
                {country.name[locale]}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="picker-empty">{labels.noMatch}</li>}
        </ul>
      )}
      <div className="picker-actions">
        {children ?? <span />}
        <button type="submit" className="button" disabled={!picked}>
          {labels.submit}
        </button>
      </div>
    </form>
  );
}
