import { numberLocale, type Locale } from "@/lib/i18n";
import { PRICES } from "@/shared/plans";

/** The prices shown in a language: reais in Portuguese, dollars in English (display only). */
export const pricesFor = (locale: Locale) => PRICES[locale];

/** 3.99 → "US$ 3.99" / "R$ 14,90". */
export function formatPrice(value: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(numberLocale(locale), { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
}

/** How much cheaper a year is than twelve months, in whole percent. */
export function yearlySaving(locale: Locale): number {
  const { monthly, yearly } = PRICES[locale];
  return Math.round((1 - yearly / (monthly * 12)) * 100);
}
