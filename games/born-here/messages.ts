export const MESSAGES = {
  en: {
    kicker: "Today's ten towns",
    lead: "A town lights up on the map. Which of the four was born there?",
    eyebrow: "Born here",
    prompt: "Who was born in *{place}*?",
    mapAria: "Map with {place} marked",
    reveal: "{name} was born in {place} in {year}.",
    answer: "{n} of {total} birthplaces right",
    answerSurvival: "{n} birthplaces before the third miss",
    help1: "Ten towns, the same for everyone today. Each one lights up on the map.",
    help2: "Pick which of the four famous people was born there — the other three were born far away.",
    help3: "After each answer the map shows where all four were born.",
    help4: "Every right answer is worth 100 points. In practice, try Survival: keep going until your third miss.",
  },
  pt: {
    kicker: "As dez cidades de hoje",
    lead: "Uma cidade se acende no mapa. Qual dos quatro nasceu ali?",
    eyebrow: "Nasceu aqui",
    prompt: "Quem nasceu em *{place}*?",
    mapAria: "Mapa com {place} marcada",
    reveal: "{name} nasceu em {place} em {year}.",
    answer: "{n} de {total} cidades certas",
    answerSurvival: "{n} cidades antes do terceiro erro",
    help1: "Dez cidades, as mesmas para todo mundo hoje. Cada uma se acende no mapa.",
    help2: "Escolha qual das quatro pessoas famosas nasceu ali — as outras três nasceram longe.",
    help3: "Depois de cada resposta, o mapa mostra onde os quatro nasceram.",
    help4: "Cada acerto vale 100 pontos. No treino, experimente o modo Sobrevivência: continue até o terceiro erro.",
  },
};

export type MessageKey = keyof (typeof MESSAGES)["en"];
