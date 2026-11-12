export const MESSAGES = {
  en: {
    kicker: "Today's gauntlet",
    lead: "Questions from every game, harder every five. Three lives: how far can you get?",
    levelFrom: "Level {level} · From {game}",
    level: "Level",
    answer: "Level {level} reached · {n} right",
    answerAll: "All {n} answered right!",
    help1: "Up to forty questions, the same for everyone today, each in the style of a different game on the site.",
    help2: "They start easy and get harder: a new level every five questions, up to level 8.",
    help3: "Three wrong answers end the run. The same kind of question never comes twice in a row.",
    help4: "Every right answer is worth 25 points: 1,000 for getting all forty.",
  },
  pt: {
    kicker: "O desafio de hoje",
    lead: "Perguntas de todos os jogos, mais difíceis a cada cinco. Três vidas: até onde você chega?",
    levelFrom: "Nível {level} · Do {game}",
    level: "Nível",
    answer: "Chegou ao nível {level} · {n} acertos",
    answerAll: "Acertou todas as {n}!",
    help1: "Até quarenta perguntas, as mesmas para todo mundo hoje, cada uma no estilo de um jogo diferente do site.",
    help2: "Começam fáceis e vão ficando difíceis: um nível novo a cada cinco perguntas, até o nível 8.",
    help3: "Três erros encerram a rodada. O mesmo tipo de pergunta nunca vem duas vezes seguidas.",
    help4: "Cada acerto vale 25 pontos: 1.000 para quem acertar as quarenta.",
  },
};

export type MessageKey = keyof (typeof MESSAGES)["en"];
