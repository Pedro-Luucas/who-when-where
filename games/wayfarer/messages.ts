"use client";

import { translator, useLocale, type Locale } from "@/lib/i18n";
import { centuryOf } from "./rules";

export const MESSAGES = {
  en: {
    kicker: "Today's journey",
    question: "Whose journey is this?",
    lead: "A famous journey is being traced on the map, one stretch at a time. Name it in six tries.",
    mapAria: "World map with the route revealed so far",
    searchLabel: "Search the journeys",
    searchPlaceholder: "Search the logbook…",
    noMatch: "No journey by that name in the logbook.",
    guess: "Guess",
    skip: "Skip · show more",
    skipped: "Skipped",
    tries: "tries",
    start: "Start",

    clueMode: "How",
    clueCentury: "When",
    clueStops: "Stops",
    clueStopsOn: "named on the map",
    unlockAt: "after try {n}",
    mode_sea: "By sea",
    mode_land: "Overland",
    mode_air: "By air",
    mode_river: "By river",
    mode_mixed: "By land and sea",

    hintLater: "It set out later",
    hintEarlier: "It set out earlier",
    hintSame: "It set out the very same year",
    gap0: "by less than 25 years",
    gap1: "by 25 to 100 years",
    gap2: "by 1 to 5 centuries",
    gap3: "by more than 5 centuries",

    solvedFirst: "Named at first sight!",
    solvedIn: "Named on try {n}",
    lost: "The trail went cold…",
    statSolved: "Solved",
    statAverage: "Avg. tries",

    help1: "Every day one famous journey — a voyage, a march, a flight — is traced on the map. Which one is it?",
    help2: "You start with just the first stretch of the route. Pick a journey from the logbook and guess.",
    help3: "A wrong guess tells you whether the real journey set out earlier or later, and draws more of the route.",
    help4: "More clues unlock on the way: how they travelled, the century, and the names of the stops.",
    help5: "Six tries. Skipping uses one up, but shows more of the map. A new journey tomorrow.",
  },
  pt: {
    kicker: "A viagem de hoje",
    question: "De quem é esta viagem?",
    lead: "Uma viagem famosa está sendo traçada no mapa, um trecho de cada vez. Descubra qual é em seis tentativas.",
    mapAria: "Mapa-múndi com o trecho da rota revelado até agora",
    searchLabel: "Buscar entre as viagens",
    searchPlaceholder: "Busque no diário de bordo…",
    noMatch: "Nenhuma viagem com esse nome no diário de bordo.",
    guess: "Chutar",
    skip: "Pular · mostrar mais",
    skipped: "Pulou",
    tries: "tentativas",
    start: "Partida",

    clueMode: "Como",
    clueCentury: "Quando",
    clueStops: "Paradas",
    clueStopsOn: "nomeadas no mapa",
    unlockAt: "após a tentativa {n}",
    mode_sea: "Por mar",
    mode_land: "Por terra",
    mode_air: "Pelo ar",
    mode_river: "Por rio",
    mode_mixed: "Por terra e mar",

    hintLater: "Ela partiu depois",
    hintEarlier: "Ela partiu antes",
    hintSame: "Ela partiu exatamente no mesmo ano",
    gap0: "com menos de 25 anos de diferença",
    gap1: "com 25 a 100 anos de diferença",
    gap2: "com 1 a 5 séculos de diferença",
    gap3: "com mais de 5 séculos de diferença",

    solvedFirst: "Reconheceu à primeira vista!",
    solvedIn: "Descoberta na tentativa {n}",
    lost: "A trilha esfriou…",
    statSolved: "Acertos",
    statAverage: "Média",

    help1: "Todo dia, uma viagem famosa — uma navegação, uma marcha, um voo — é traçada no mapa. Qual é?",
    help2: "Você começa só com o primeiro trecho da rota. Escolha uma viagem no diário de bordo e chute.",
    help3: "Um chute errado diz se a viagem verdadeira partiu antes ou depois, e desenha mais um trecho da rota.",
    help4: "Mais pistas se abrem no caminho: como viajaram, o século e os nomes das paradas.",
    help5: "Seis tentativas. Pular gasta uma, mas mostra mais do mapa. Amanhã tem outra viagem.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)["en"];

export function useGameT() {
  const locale = useLocale();
  return { locale, t: translator(MESSAGES, locale) };
}

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function roman(value: number): string {
  let rest = value;
  let out = "";
  for (const [amount, symbol] of ROMAN) {
    while (rest >= amount) {
      out += symbol;
      rest -= amount;
    }
  }
  return out;
}

function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}

/** "16th century" / "século XVI"; "4th century BC" / "século IV a.C." */
export function centuryLabel(year: number, locale: Locale): string {
  const century = centuryOf(year);
  const n = Math.abs(century);
  if (locale === "pt") return `século ${roman(n)}${century < 0 ? " a.C." : ""}`;
  return `${ordinal(n)} century${century < 0 ? " BC" : ""}`;
}
