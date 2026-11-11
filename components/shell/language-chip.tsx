"use client";

import { setLocale, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";

/** The header's language chip: shows the language in use, and switches to the other. */
export function LanguageChip() {
  const locale = useLocale();
  const t = useShellT();
  const other = locale === "pt" ? "en" : "pt";
  return (
    <button
      type="button"
      className="language-chip"
      onClick={() => setLocale(other)}
      aria-label={t("switchLanguage")}
      title={t("switchLanguage")}
      lang={other === "pt" ? "pt-BR" : "en"}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z" />
      </svg>
      <span aria-hidden="true">{locale.toUpperCase()}</span>
    </button>
  );
}
