import { OG_SIZE, playerCard, type PlayerCard } from "@/lib/og-cards";
import { cleanHandle, readPublicApi } from "@/lib/server-api";

// The picture a profile link unfolds into in a chat: name, league and the
// headline numbers. A friends-only profile shows the name alone.

export const alt = "A player's profile on Who When Where";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const handle = cleanHandle((await params).username) ?? "player";
  const profile = await readPublicApi<{ user: PlayerCard; private?: boolean; leagueTier?: number | null; stats?: PlayerCard["stats"] }>(
    `/players/${handle}`,
  );
  return playerCard(
    profile ? { ...profile.user, private: profile.private, leagueTier: profile.leagueTier, stats: profile.stats } : null,
    handle,
  );
}
