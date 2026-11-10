"use client";

import { useSyncExternalStore } from "react";
import { readStore, subscribeToStore, writeStore } from "./storage";

export type Locale = "en" | "pt";
export type Localized = Record<Locale, string>;

const LOCALE_KEY = "locale";

function detectLocale(): Locale {
  return navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en";
}

function currentLocale(): Locale {
  return readStore<Locale | null>(LOCALE_KEY, null) ?? detectLocale();
}

/** The player's language: their saved choice, else the browser's. */
export function useLocale(): Locale {
  // The server renders English; the client corrects it right after hydration.
  return useSyncExternalStore(subscribeToStore, currentLocale, () => "en");
}

export function setLocale(locale: Locale): void {
  writeStore(LOCALE_KEY, locale);
}

type Vars = Record<string, string | number>;

/** Builds `t(key, vars)` for one dictionary: "{name}" placeholders are filled from vars. */
export function translator<M extends Record<string, string>>(
  dictionary: Record<Locale, M>,
  locale: Locale,
) {
  return (key: keyof M, vars?: Vars): string => {
    const template = dictionary[locale][key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
  };
}

export const numberLocale = (locale: Locale) => (locale === "pt" ? "pt-BR" : "en-US");

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(numberLocale(locale)).format(value);
}

// Site-wide strings. Each game keeps its own dictionary next to its code.
export const SITE_MESSAGES = {
  en: {
    tagline: "Daily guessing games about people, places and time.",
    hubLead: "One new puzzle every day.",
    hubLeadSub: "The same one for everybody.",
    heroWho: "a famous mind, every day",
    heroWhen: "the years they were born and died",
    heroWhere: "the places, pinned on the map",
    todaysGames: "Today's games",
    play: "Play",
    continue: "Continue",
    seeResult: "See result",
    notPlayed: "Not played yet",
    inProgress: "In progress",
    comingSoon: "More games on the way",
    comingSoonBody: "New daily geography games will show up here.",
    help: "How to play",
    stats: "Statistics",
    language: "Language",
    allGames: "All games",
    dataCredit: "Data and portraits from Wikipedia, Wikidata and Wikimedia Commons.",
    close: "Close",
  },
  pt: {
    tagline: "Jogos diários de adivinhação sobre pessoas, lugares e tempo.",
    hubLead: "Um desafio novo por dia.",
    hubLeadSub: "O mesmo para todo mundo.",
    heroWho: "uma mente famosa, todo dia",
    heroWhen: "os anos em que nasceu e morreu",
    heroWhere: "os lugares, marcados no mapa",
    todaysGames: "Jogos de hoje",
    play: "Jogar",
    continue: "Continuar",
    seeResult: "Ver resultado",
    notPlayed: "Ainda não jogado",
    inProgress: "Em andamento",
    comingSoon: "Mais jogos a caminho",
    comingSoonBody: "Novos jogos diários de geografia vão aparecer aqui.",
    help: "Como jogar",
    stats: "Estatísticas",
    language: "Idioma",
    allGames: "Todos os jogos",
    dataCredit: "Dados e retratos da Wikipedia, Wikidata e Wikimedia Commons.",
    close: "Fechar",
  },
} satisfies Record<Locale, Record<string, string>>;

export function useSiteT() {
  return translator(SITE_MESSAGES, useLocale());
}
