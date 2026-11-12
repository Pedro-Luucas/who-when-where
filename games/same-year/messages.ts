export const MESSAGES = {
  en: {
    kicker: "Today's ten rounds",
    lead: "Four moments in history. Three of them happened in the same year — which one didn't?",
    eyebrow: "Odd one out",
    prompt: "Three of these happened in the *same year*. Which one is the odd one out?",
    reveal: "The other three: {year}. The odd one: {odd}.",
    answer: "{n} of {total} odd ones found",
    help1: "Ten rounds of four moments — events, births and deaths — the same for everyone today.",
    help2: "In each round, three happened in the same year. Pick the one that didn't.",
    help3: "The odd one is never far off: between 2 and 30 years away from the others.",
    help4: "After each answer you see every year. Every right answer is worth 100 points.",
  },
  pt: {
    kicker: "As dez rodadas de hoje",
    lead: "Quatro momentos da história. Três aconteceram no mesmo ano — qual não?",
    eyebrow: "O intruso",
    prompt: "Três destes aconteceram no *mesmo ano*. Qual é o intruso?",
    reveal: "Os outros três: {year}. O intruso: {odd}.",
    answer: "{n} de {total} intrusos encontrados",
    help1: "Dez rodadas de quatro momentos — fatos, nascimentos e mortes —, as mesmas para todo mundo hoje.",
    help2: "Em cada rodada, três aconteceram no mesmo ano. Escolha o que não aconteceu.",
    help3: "O intruso nunca está longe: entre 2 e 30 anos de diferença dos outros.",
    help4: "Depois de cada resposta você vê todos os anos. Cada acerto vale 100 pontos.",
  },
};

export type MessageKey = keyof (typeof MESSAGES)["en"];
