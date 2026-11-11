"use client";

import { useEffect } from "react";
import { htmlLang, useLocale } from "@/lib/i18n";

/** Keeps <html lang> on the player's language as they change it (the head script sets it for the first paint). */
export function LangSync() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);
  return null;
}
