import { GAME_TITLES, isGameSlug } from "@/games/registry";
import { challengeCard, OG_SIZE } from "@/lib/og-cards";
import { MAX_POINTS } from "@/lib/points";
import { readPublicApi } from "@/lib/server-api";

// The picture a challenge link unfolds into: who dares you, and the score to beat.

export const alt = "A challenge on Who When Where";
export const size = OG_SIZE;
export const contentType = "image/png";

type Answer = {
  challenge: {
    from: { name: string; avatar: number };
    stages: number;
    players: number;
    settings: { rounds: Record<string, number> };
    entries: { user: { id: string }; points: number }[];
  } & { from: { id: string } };
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const answer = /^[A-Za-z0-9]{4,16}$/.test(id) ? await readPublicApi<Answer>(`/challenges/${id}`) : null;
  if (!answer) return challengeCard(null);
  const { challenge } = answer;
  const games = Object.entries(challenge.settings.rounds)
    .filter(([game, rounds]) => rounds > 0 && isGameSlug(game))
    .map(([game]) => GAME_TITLES[game as keyof typeof GAME_TITLES]);
  return challengeCard({
    from: challenge.from,
    points: challenge.entries.find((entry) => entry.user.id === challenge.from.id)?.points ?? 0,
    max: challenge.stages * MAX_POINTS,
    stages: challenge.stages,
    players: challenge.players,
    games,
  });
}
