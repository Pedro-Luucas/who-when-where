"use client";

import { useSyncExternalStore } from "react";
import { readStore, subscribeToStore, writeStore } from "./storage";

export type Locale = "en" | "pt";
export type Localized = Record<Locale, string>;

const LOCALE_KEY = "locale";

/** What the server renders, and the language for a browser that names neither Portuguese nor English. */
export const DEFAULT_LOCALE: Locale = "pt";

/**
 * The language a browser asks for: the first of its languages that the site
 * has, else English. (Portuguese stays what the server renders; see useLocale.)
 */
export function browserLocale(): Locale {
  const asked = typeof navigator === "undefined" ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
  for (const language of asked) {
    const base = String(language).toLowerCase().split("-")[0];
    if (base === "pt" || base === "en") return base;
  }
  return "en";
}

/** The player's language: their saved choice, else the browser's. Browser only. */
export function getLocale(): Locale {
  return readStore<Locale | null>(LOCALE_KEY, null) ?? browserLocale();
}

/** The value of <html lang> for a language. */
export const htmlLang = (locale: Locale): string => (locale === "pt" ? "pt-BR" : "en");

/**
 * Runs in <head> before the first paint, so <html lang> matches the player's
 * language from the start (same choice as getLocale, without the modules).
 */
export const LOCALE_SCRIPT = `(function(){try{var l=JSON.parse(localStorage.getItem("www:${LOCALE_KEY}")||"null");if(l!=="pt"&&l!=="en"){l="en";var a=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];for(var i=0;i<a.length;i++){var b=String(a[i]).toLowerCase().split("-")[0];if(b==="pt"||b==="en"){l=b;break}}}document.documentElement.lang=l==="pt"?"pt-BR":"en"}catch(e){}})()`;

/** The player's language, as a hook. */
export function useLocale(): Locale {
  // The server renders the default; the client corrects it right after hydration.
  return useSyncExternalStore(subscribeToStore, getLocale, () => DEFAULT_LOCALE);
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
    errorTitle: "Something went wrong",
    errorLead: "This page hit a problem. Your saved games are safe on this device. Try again, or go back to the start.",
    errorRetry: "Try again",
    errorHome: "Back to the start",
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
    upNext: "Up next",
    dayProgress: "{n} of {total} done today",
    dayDone: "All {n} of today’s puzzles done!",
    dayDoneCta: "See your day",
    backToToday: "Today’s puzzles",
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
    help: "How to play",
    stats: "Statistics",
    language: "Language",
    allGames: "All games",
    dataCredit: "Data, texts and images from Wikipedia, Wikidata and Wikimedia Commons.",
    close: "Close",
    statsSpread: "How your puzzles went",
    logbook: "Logbook",
    settings: "Settings",
    theme: "Theme",
    theme_auto: "Auto",
    theme_light: "Light",
    theme_dark: "Dark",
    sound: "Sound",
    haptics: "Vibration",
    effects: "Confetti",
    on: "On",
    off: "Off",
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
    errorTitle: "Algo deu errado",
    errorLead: "Esta página encontrou um problema. Seus jogos salvos continuam seguros neste aparelho. Tente de novo ou volte ao início.",
    errorRetry: "Tentar de novo",
    errorHome: "Voltar ao início",
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
    upNext: "A seguir",
    dayProgress: "{n} de {total} feitos hoje",
    dayDone: "Os {n} desafios de hoje, feitos!",
    dayDoneCta: "Ver o seu dia",
    backToToday: "Desafios de hoje",
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
    help: "Como jogar",
    stats: "Estatísticas",
    language: "Idioma",
    allGames: "Todos os jogos",
    dataCredit: "Dados, textos e imagens da Wikipedia, Wikidata e Wikimedia Commons.",
    close: "Fechar",
    statsSpread: "Como foram os seus desafios",
    logbook: "Diário de bordo",
    settings: "Ajustes",
    theme: "Tema",
    theme_auto: "Auto",
    theme_light: "Claro",
    theme_dark: "Escuro",
    sound: "Som",
    haptics: "Vibração",
    effects: "Confete",
    on: "Sim",
    off: "Não",
  },
} satisfies Record<Locale, Record<string, string>>;

export function useSiteT() {
  return translator(SITE_MESSAGES, useLocale());
}
