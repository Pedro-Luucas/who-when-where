"use client";

import { searchCountries, type Country } from "@/lib/countries";
import { useLocale } from "@/lib/i18n";
import { GuessCombobox } from "./ui/guess-combobox";

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

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

/**
 * Names a country: type a few letters, pick from the matches. Typing down to
 * a single country is as good as tapping it; the arrow keys move the choice
 * (the game picker's combobox, components/ui/guess-combobox.tsx).
 */
export function CountryPicker({ pool, taken, onSubmit, labels, children }: Props) {
  const locale = useLocale();
  return (
    <GuessCombobox
      search={(query) =>
        searchCountries(query, pool, locale).map((country) => ({
          id: country.id,
          label: country.name[locale],
          taken: taken.has(country.id),
        }))
      }
      exact={(query) => pool.find((country) => fold(country.name[locale]) === fold(query))?.id}
      onSubmit={onSubmit}
      labels={labels}
    >
      {children}
    </GuessCombobox>
  );
}
