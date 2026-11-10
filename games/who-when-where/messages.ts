"use client";

import { translator, useLocale, type Locale } from "@/lib/i18n";

export const MESSAGES = {
  en: {
    // Round questions: {name} is the person; *…* marks the emphasised word.
    q_birthPlace: "Where was {name} *born*?",
    q_birthYear: "When was {name} *born*?",
    q_deathPlace: "Where did {name} *die*?",
    q_deathYear: "When did {name} *die*?",
    r_birthPlace: "Born · where",
    r_birthYear: "Born · when",
    r_deathPlace: "Died · where",
    r_deathYear: "Died · when",
    born: "Born",
    died: "Died",
    todaysMind: "Today's mind",

    mapHint: "Tap the map to drop your pin",
    mapHintZoom: "Pinch, scroll or drag to move around",
    yourPin: "Your pin",
    yearHint: "Drag the ruler, tap the steps or type a year",
    yearLabel: "Year",

    lockIn: "Lock in guess",
    next: "Next question",
    seeResults: "See results",

    kmAway: "{km} km away",
    bullseye: "Right on the spot!",
    yearsOff: "{n} years off",
    yearOff: "1 year off",
    exactYear: "The exact year!",
    yourGuess: "Your guess",
    answer: "Answer",
    points: "pts",

    resultTitle: "Final score",
    rank0: "Lost tourist",
    rank1: "Curious mind",
    rank2: "Keen student",
    rank3: "Scholar",
    rank4: "Walking encyclopedia",
    lifeArc: "A life, from first to last",
    lived: "{n} years",
    nextIn: "Next mind in",
    portraitCredit: "Portrait via Wikimedia Commons",

    statAverage: "Average",
    statBest: "Best",

    help1: "Every day brings one famous mind and four questions about their life.",
    help2: "Where: drop a pin on the map. The closer to the real place, the more points.",
    help3: "When: set the year on the ruler. Every year off costs you points.",
    help4: "Each answer is worth up to 250 points — 1,000 for a perfect day.",
    help5: "Everyone gets the same person. Come back tomorrow for the next one.",
  },
  pt: {
    q_birthPlace: "Onde *nasceu* {name}?",
    q_birthYear: "Quando *nasceu* {name}?",
    q_deathPlace: "Onde *morreu* {name}?",
    q_deathYear: "Quando *morreu* {name}?",
    r_birthPlace: "Nasceu · onde",
    r_birthYear: "Nasceu · quando",
    r_deathPlace: "Morreu · onde",
    r_deathYear: "Morreu · quando",
    born: "Nasceu",
    died: "Morreu",
    todaysMind: "A mente de hoje",

    mapHint: "Toque no mapa para marcar seu palpite",
    mapHintZoom: "Pince, role ou arraste para navegar",
    yourPin: "Seu palpite",
    yearHint: "Arraste a régua, toque nos passos ou digite um ano",
    yearLabel: "Ano",

    lockIn: "Confirmar palpite",
    next: "Próxima pergunta",
    seeResults: "Ver resultado",

    kmAway: "a {km} km",
    bullseye: "Na mosca!",
    yearsOff: "{n} anos de diferença",
    yearOff: "1 ano de diferença",
    exactYear: "O ano exato!",
    yourGuess: "Seu palpite",
    answer: "Resposta",
    points: "pts",

    resultTitle: "Pontuação final",
    rank0: "Turista perdido",
    rank1: "Mente curiosa",
    rank2: "Bom aluno",
    rank3: "Erudito",
    rank4: "Enciclopédia ambulante",
    lifeArc: "Uma vida, do começo ao fim",
    lived: "{n} anos",
    nextIn: "Próxima mente em",
    portraitCredit: "Retrato via Wikimedia Commons",

    statAverage: "Média",
    statBest: "Melhor",

    help1: "Todo dia traz uma mente famosa e quatro perguntas sobre a vida dela.",
    help2: "Onde: marque um ponto no mapa. Quanto mais perto do lugar real, mais pontos.",
    help3: "Quando: ajuste o ano na régua. Cada ano de diferença custa pontos.",
    help4: "Cada resposta vale até 250 pontos — 1.000 em um dia perfeito.",
    help5: "Todo mundo recebe a mesma pessoa. Volte amanhã para a próxima.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)["en"];

export function useGameT() {
  const locale = useLocale();
  return { locale, t: translator(MESSAGES, locale) };
}
