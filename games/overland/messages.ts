"use client";

import { translator, useLocale, type Locale } from "@/lib/i18n";

export const MESSAGES = {
  en: {
    kicker: "Today's crossing",
    // *…* marks the two ends.
    question: "From *{from}* to *{to}*",
    lead: "Join them overland: name the countries in between, in any order.",
    mapAria: "World map with the two countries to join",
    clueFewest: "Shortest way",
    clueFewestValue: "{n} countries",
    clueFewestOne: "1 country",
    clueLeft: "Guesses left",
    clueOnWay: "On the way",
    searchPlaceholder: "Name a country…",
    searchLabel: "Name a country",
    guess: "Cross the border",
    noMatch: "No country with a land border matches.",
    firstHint: "Only countries that share a land border count. You have {n} guesses.",
    verdict_on: "On the way",
    verdict_near: "A small detour",
    verdict_off: "Off course",
    hint_on: "A shortest route passes through here.",
    hint_near: "One border out of the way.",
    hint_off: "No help on this trip.",
    guesses: "guesses",
    solvedShortest: "The shortest way — not a border wasted!",
    solvedIn: "Arrived, through {n} countries",
    lost: "Stranded on the way…",
    theWay: "A shortest way",
    statArrived: "Arrived",
    statShortest: "Shortest way",
    help1: "Every day brings two countries. Your job is to travel from one to the other overland.",
    help2: "Name the countries in between, in any order. You arrive when your countries join the two ends, border to border.",
    help3: "Each country you name is coloured on the map: on a shortest route, one border out of the way, or off course.",
    help4: "The fewer countries you waste, the more points. You get four guesses more than the shortest way needs.",
    help5: "Everyone makes the same crossing. A new one tomorrow.",
  },
  pt: {
    kicker: "A travessia de hoje",
    question: "De *{from}* até *{to}*",
    lead: "Ligue os dois por terra: diga os países que ficam no caminho, em qualquer ordem.",
    mapAria: "Mapa-múndi com os dois países a ligar",
    clueFewest: "Caminho mais curto",
    clueFewestValue: "{n} países",
    clueFewestOne: "1 país",
    clueLeft: "Palpites restantes",
    clueOnWay: "No caminho",
    searchPlaceholder: "Diga um país…",
    searchLabel: "Diga um país",
    guess: "Cruzar a fronteira",
    noMatch: "Nenhum país com fronteira terrestre corresponde.",
    firstHint: "Só valem países com fronteira terrestre. Você tem {n} palpites.",
    verdict_on: "No caminho",
    verdict_near: "Um pequeno desvio",
    verdict_off: "Fora de rota",
    hint_on: "Um dos caminhos mais curtos passa por aqui.",
    hint_near: "Uma fronteira fora do caminho.",
    hint_off: "Não ajuda nesta viagem.",
    guesses: "palpites",
    solvedShortest: "O caminho mais curto — nenhuma fronteira desperdiçada!",
    solvedIn: "Chegou, passando por {n} países",
    lost: "Ficou pelo caminho…",
    theWay: "Um caminho mais curto",
    statArrived: "Chegadas",
    statShortest: "Caminho mais curto",
    help1: "Todo dia traz dois países. Sua missão é viajar de um ao outro por terra.",
    help2: "Diga os países que ficam no caminho, em qualquer ordem. Você chega quando os seus países ligam as duas pontas, de fronteira em fronteira.",
    help3: "Cada país que você diz é colorido no mapa: num dos caminhos mais curtos, uma fronteira fora do caminho, ou fora de rota.",
    help4: "Quanto menos países desperdiçados, mais pontos. Você tem quatro palpites além do que o caminho mais curto exige.",
    help5: "Todo mundo faz a mesma travessia. Amanhã, uma nova.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)["en"];

export function useGameT() {
  const locale = useLocale();
  return { locale, t: translator(MESSAGES, locale) };
}
