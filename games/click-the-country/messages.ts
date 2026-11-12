export const MESSAGES = {
  en: {
    kicker: "Today's ten countries",
    lead: "A country's name. Find it on the map and tap it — three tries each.",
    eyebrow: "Find the country",
    prompt: "Where is *{country}*?",
    sea: "That's the sea — tap a country",
    thatIs: "That's {country}",
    found: "Found on try {n}",
    foundFirst: "Found at once!",
    notFound: "Not found",
    help1: "Ten countries, the same for everyone today.",
    help2: "Each round names a country, nothing more. Tap it on the map, then lock it in.",
    help3: "A wrong country is named and coloured on the map. You have three tries per country.",
    help4: "Finding it on the first try is worth the most. In practice you can play one continent, small countries included.",
  },
  pt: {
    kicker: "Os dez países de hoje",
    lead: "O nome de um país. Ache no mapa e toque nele — três tentativas cada.",
    eyebrow: "Ache o país",
    prompt: "Onde fica *{country}*?",
    sea: "Isso é mar — toque num país",
    thatIs: "Esse é {country}",
    found: "Achou na tentativa {n}",
    foundFirst: "Achou de primeira!",
    notFound: "Não achou",
    help1: "Dez países, os mesmos para todo mundo hoje.",
    help2: "Cada rodada diz só o nome de um país. Toque nele no mapa e confirme.",
    help3: "Um país errado aparece com o nome e colorido no mapa. São três tentativas por país.",
    help4: "Achar de primeira vale mais. No treino dá para jogar um continente só, incluindo os países pequenos.",
  },
};

export type MessageKey = keyof (typeof MESSAGES)["en"];
