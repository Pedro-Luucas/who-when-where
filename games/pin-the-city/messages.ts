export const MESSAGES = {
  en: {
    kicker: "Today's ten cities",
    lead: "A city's name. Drop a pin where it is — the closer, the more points.",
    eyebrow: "Find the city",
    eyebrowCapital: "Find the capital",
    prompt: "Where is *{city}*?",
    nothing: "Tap the map to drop your pin",
    yourPin: "Your pin",
    km: "{km} km off",
    spotOn: "Spot on!",
    help1: "Ten cities, the same for everyone today: big cities and capitals from all over the world.",
    help2: "Each round names a city — just the city, so you have to know where it is. Tap the map where you think it is, then lock it in.",
    help3: "A pin within 25 km earns full marks; the further away, the fewer points.",
    help4: "In practice you can stay on one continent, with more cities to choose from.",
  },
  pt: {
    kicker: "As dez cidades de hoje",
    lead: "O nome de uma cidade. Marque onde ela fica — quanto mais perto, mais pontos.",
    eyebrow: "Ache a cidade",
    eyebrowCapital: "Ache a capital",
    prompt: "Onde fica *{city}*?",
    nothing: "Toque no mapa para marcar",
    yourPin: "Sua marca",
    km: "{km} km de distância",
    spotOn: "Na mosca!",
    help1: "Dez cidades, as mesmas para todo mundo hoje: grandes cidades e capitais do mundo todo.",
    help2: "Cada rodada diz só o nome de uma cidade — o país fica por sua conta. Toque no mapa onde acha que ela fica e confirme.",
    help3: "Uma marca a menos de 25 km vale a pontuação máxima; quanto mais longe, menos pontos.",
    help4: "No treino dá para ficar num continente só, com mais cidades.",
  },
};

export type MessageKey = keyof (typeof MESSAGES)["en"];
