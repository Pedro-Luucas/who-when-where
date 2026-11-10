"use client";

import { useEffect } from "react";
import { setLocale, useLocale, useSiteT, type Locale } from "@/lib/i18n";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "pt", label: "PT" },
];

export function LocaleToggle() {
  const locale = useLocale();
  const t = useSiteT();

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
  }, [locale]);

  return (
    <div className="locale-toggle" role="group" aria-label={t("language")}>
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          aria-pressed={locale === option.locale}
          onClick={() => setLocale(option.locale)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
