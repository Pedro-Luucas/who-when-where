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

/** 1859 → "1859"; -334 → "334 BC" / "334 a.C." */
export function formatYear(year: number, locale: Locale): string {
  if (year > 0) return String(year);
  return `${-year} ${locale === "pt" ? "a.C." : "BC"}`;
}

// Site-wide strings. Each game keeps its own dictionary next to its code.
export const SITE_MESSAGES = {
  en: {
    tagline: "Daily guessing games about people, places and time.",
    hubLead: "A new puzzle in every game, every day.",
    hubLeadSub: "The same ones for everybody.",
    heroWho: "minds, travellers and lost cities",
    heroWhen: "the years — and the right order",
    heroWhere: "all of it, pinned on the map",
    todaysGames: "Today's games",
    puzzleNo: "No. {n}",
    mapLoading: "Unrolling the map…",
    mapError: "The map could not be loaded. Check your connection and reload.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoomReset: "Whole world",
    mapHint: "Tap the map to drop your pin",
    mapHintZoom: "Pinch, scroll or drag to move around",
    yourPin: "Your pin",
    share: "Share result",
    copied: "Copied to clipboard",
    nextIn: "Next puzzle in",
    readMore: "Read more on Wikipedia",
    photoCredit: "Photo via Wikimedia Commons",
    helpStart: "Start",
    statPlayed: "Played",
    statStreak: "Streak",
    statLongest: "Longest streak",
    statsEmpty: "Finish today's puzzle to start your record.",
    play: "Play",
    continue: "Continue",
    seeResult: "See result",
    notPlayed: "Not played yet",
    inProgress: "In progress",
    comingSoon: "More games on the way",
    comingSoonBody: "New daily history-and-geography games will show up here.",
    help: "How to play",
    stats: "Statistics",
    language: "Language",
    allGames: "All games",
    dataCredit: "Data, texts and images from Wikipedia, Wikidata and Wikimedia Commons.",
    close: "Close",
  },
  pt: {
    tagline: "Jogos diários de adivinhação sobre pessoas, lugares e tempo.",
    hubLead: "Um desafio novo em cada jogo, todo dia.",
    hubLeadSub: "Os mesmos para todo mundo.",
    heroWho: "mentes, viajantes e cidades perdidas",
    heroWhen: "os anos — e a ordem certa",
    heroWhere: "tudo isso, marcado no mapa",
    todaysGames: "Jogos de hoje",
    puzzleNo: "N.º {n}",
    mapLoading: "Desenrolando o mapa…",
    mapError: "Não foi possível carregar o mapa. Verifique a conexão e recarregue.",
    zoomIn: "Aproximar",
    zoomOut: "Afastar",
    zoomReset: "Mundo inteiro",
    mapHint: "Toque no mapa para marcar seu palpite",
    mapHintZoom: "Pince, role ou arraste para navegar",
    yourPin: "Seu palpite",
    share: "Compartilhar resultado",
    copied: "Copiado para a área de transferência",
    nextIn: "Próximo desafio em",
    readMore: "Leia mais na Wikipedia",
    photoCredit: "Foto via Wikimedia Commons",
    helpStart: "Começar",
    statPlayed: "Jogos",
    statStreak: "Sequência",
    statLongest: "Maior sequência",
    statsEmpty: "Termine o desafio de hoje para começar seu histórico.",
    play: "Jogar",
    continue: "Continuar",
    seeResult: "Ver resultado",
    notPlayed: "Ainda não jogado",
    inProgress: "Em andamento",
    comingSoon: "Mais jogos a caminho",
    comingSoonBody: "Novos jogos diários de história e geografia vão aparecer aqui.",
    help: "Como jogar",
    stats: "Estatísticas",
    language: "Idioma",
    allGames: "Todos os jogos",
    dataCredit: "Dados, textos e imagens da Wikipedia, Wikidata e Wikimedia Commons.",
    close: "Fechar",
  },
} satisfies Record<Locale, Record<string, string>>;

export function useSiteT() {
  return translator(SITE_MESSAGES, useLocale());
}
