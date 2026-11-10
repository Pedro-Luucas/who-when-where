"use client";

import { translator, useLocale, type Locale } from "@/lib/i18n";

export const MESSAGES = {
  en: {
    kicker: "Today's six",
    // *…* marks the emphasised word.
    question: "Which came *first*?",
    lead: "Six moments in history, six pins on the map. Put them in the order they happened.",
    mapAria: "World map with today's six events",
    earliest: "Earliest",
    latest: "Latest",
    place: "Place",
    remove: "Take back",
    check: "Check the order",
    howTo: "Tap an event — or its pin — to place it next in line. Tap it again to take it back.",
    feedback: "{n} of 6 in the right place. They stay put; reorder the rest.",
    feedbackNone: "None in the right place yet. Try a different order.",
    lastTry: "Last try!",
    triesLeft: "{n} tries left.",
    tries: "tries",
    circa: "c.",
    flawless: "Flawless: in order at the first try!",
    solvedIn: "In order on try {n}",
    lost: "{n} of 6 in the right place",
    theOrder: "As it happened",
    statSolved: "Solved",
    statFlawless: "Flawless",
    help1: "Every day brings six moments in history, each pinned where it happened.",
    help2: "Tap them in the order they happened, earliest first. A thread on the map follows your order.",
    help3: "Check the order: events in the right position lock in place, and you reorder the rest.",
    help4: "You have three tries to get all six right.",
    help5: "Everyone gets the same six. Six new ones tomorrow.",
  },
  pt: {
    kicker: "Os seis de hoje",
    question: "O que veio *primeiro*?",
    lead: "Seis momentos da história, seis pinos no mapa. Coloque-os na ordem em que aconteceram.",
    mapAria: "Mapa-múndi com os seis acontecimentos de hoje",
    earliest: "Mais antigo",
    latest: "Mais recente",
    place: "Colocar",
    remove: "Retirar",
    check: "Conferir a ordem",
    howTo: "Toque em um acontecimento — ou no pino dele — para colocá-lo na fila. Toque de novo para retirá-lo.",
    feedback: "{n} de 6 no lugar certo. Eles ficam fixos; reordene o resto.",
    feedbackNone: "Nenhum no lugar certo ainda. Tente outra ordem.",
    lastTry: "Última tentativa!",
    triesLeft: "Restam {n} tentativas.",
    tries: "tentativas",
    circa: "c.",
    flawless: "Impecável: em ordem na primeira tentativa!",
    solvedIn: "Em ordem na tentativa {n}",
    lost: "{n} de 6 no lugar certo",
    theOrder: "Como aconteceu",
    statSolved: "Acertos",
    statFlawless: "Impecáveis",
    help1: "Todo dia traz seis momentos da história, cada um marcado onde aconteceu.",
    help2: "Toque neles na ordem em que aconteceram, do mais antigo ao mais recente. Um fio no mapa acompanha a sua ordem.",
    help3: "Confira a ordem: os que estiverem na posição certa ficam travados, e você reordena o resto.",
    help4: "Você tem três tentativas para acertar os seis.",
    help5: "Todo mundo recebe os mesmos seis. Amanhã, seis novos.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)["en"];

export function useGameT() {
  const locale = useLocale();
  return { locale, t: translator(MESSAGES, locale) };
}
