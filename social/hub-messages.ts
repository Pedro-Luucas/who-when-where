"use client";

import { translator, useLocale, type Locale } from "@/lib/i18n";

// Strings for the community hub: the cards at the top of /community, the
// friends' day board and the podium on the leaderboard.

const HUB_MESSAGES = {
  en: {
    hubEyebrow: "Your community today",
    todayWithFriends: "Today with friends",
    todayWithFriendsLead: "Everyone's points from today's dailies.",
    fullBoard: "Full leaderboard",
    you: "you",
    noFriendsYet: "No friends yet",
    noFriendsLead: "Add a friend by username, or send your invite link: you'll see each other's daily scores here.",
    nobodyPlayed: "Nobody has played yet today. Be the first on the board.",
    playToday: "Play today's dailies",
    onlineNow: "Online now",
    onlineNone: "None of your friends is online right now.",
    cardLeague: "Weekly league",
    cardLeagueRank: "#{rank} of {size} · {tier}",
    cardLeagueIdle: "{tier} · play a daily to join",
    cardWeekly: "Weekly Special",
    cardWeeklyMine: "#{rank} · {points} pts · {left} left",
    cardWeeklyIdle: "New board · {left} left",
    cardParty: "Party",
    cardPartyOpen: "{n} open rooms right now",
    cardPartyOpen_one: "1 open room right now",
    cardPartyNone: "Start a room for up to 12",
    cardChallenge: "Challenge a friend",
    cardChallengeLead: "Same puzzles, one link",
    podium: "Top three",
    yourPlace: "Your place",
    yourPlaceLead: "#{rank} with {points} points",
    reqAccepted: "You are friends now",
    h2hTitle: "You vs {name}",
    h2hLead: "Days you both played, and your averages game by game.",
    h2hDays: "Shared days",
    h2hWins: "Your wins",
    h2hLosses: "Their wins",
    h2hTies: "Ties",
    h2hNone: "You have not played on the same day yet. Play today's dailies and come back.",
    h2hAvg: "average",
    h2hYou: "You",
    homeCommunity: "Community",
    homeCommunityOpen: "Open the community",
    homePitchTitle: "Better with friends",
    homePitchLead: "A free account turns the dailies into a game with your people.",
    pitchBoards: "Daily, weekly and all-time leaderboards",
    pitchLeague: "A weekly league from Bronze to Diamond",
    pitchParty: "Live parties for up to 12, with chat",
    pitchChallenge: "Challenge a friend to the very same puzzles",
    pitchCta: "Create a free account",
    reqDeclined: "Request declined",
  },
  pt: {
    hubEyebrow: "Sua comunidade hoje",
    todayWithFriends: "Hoje com os amigos",
    todayWithFriendsLead: "Os pontos de todo mundo nos desafios diários de hoje.",
    fullBoard: "Ranking completo",
    you: "você",
    noFriendsYet: "Nenhum amigo ainda",
    noFriendsLead: "Adicione um amigo pelo nome de usuário ou mande seu link de convite: vocês vão ver as pontuações um do outro aqui.",
    nobodyPlayed: "Ninguém jogou ainda hoje. Seja o primeiro no ranking.",
    playToday: "Jogar os diários de hoje",
    onlineNow: "Online agora",
    onlineNone: "Nenhum amigo seu está online agora.",
    cardLeague: "Liga semanal",
    cardLeagueRank: "#{rank} de {size} · {tier}",
    cardLeagueIdle: "{tier} · jogue um diário para entrar",
    cardWeekly: "Especial da semana",
    cardWeeklyMine: "#{rank} · {points} pts · faltam {left}",
    cardWeeklyIdle: "Ranking novo · faltam {left}",
    cardParty: "Party",
    cardPartyOpen: "{n} salas abertas agora",
    cardPartyOpen_one: "1 sala aberta agora",
    cardPartyNone: "Abra uma sala para até 12",
    cardChallenge: "Desafie um amigo",
    cardChallengeLead: "Os mesmos puzzles, um link",
    podium: "Os três primeiros",
    yourPlace: "Sua posição",
    yourPlaceLead: "#{rank} com {points} pontos",
    reqAccepted: "Agora vocês são amigos",
    h2hTitle: "Você vs {name}",
    h2hLead: "Os dias em que vocês dois jogaram, e as médias jogo a jogo.",
    h2hDays: "Dias em comum",
    h2hWins: "Suas vitórias",
    h2hLosses: "Vitórias dele(a)",
    h2hTies: "Empates",
    h2hNone: "Vocês ainda não jogaram no mesmo dia. Jogue os diários de hoje e volte aqui.",
    h2hAvg: "média",
    h2hYou: "Você",
    homeCommunity: "Comunidade",
    homeCommunityOpen: "Abrir a comunidade",
    homePitchTitle: "Melhor com amigos",
    homePitchLead: "Uma conta grátis transforma os diários num jogo com a sua galera.",
    pitchBoards: "Rankings do dia, da semana e de sempre",
    pitchLeague: "Uma liga semanal do Bronze ao Diamante",
    pitchParty: "Partidas ao vivo para até 12, com chat",
    pitchChallenge: "Desafie um amigo com os mesmos puzzles",
    pitchCta: "Criar conta grátis",
    reqDeclined: "Pedido recusado",
  },
} satisfies Record<Locale, Record<string, string>>;

export type HubKey = keyof (typeof HUB_MESSAGES)["en"];

export function useHubT() {
  const locale = useLocale();
  const dictionary = HUB_MESSAGES[locale] as Record<string, string>;
  const fill = translator(HUB_MESSAGES, locale);
  const t = (key: HubKey, vars?: Record<string, string | number>): string => {
    const singular = `${key}_one`;
    return fill((vars?.n === 1 && singular in dictionary ? singular : key) as HubKey, vars);
  };
  return { locale, t };
}
