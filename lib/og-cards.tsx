import { ImageResponse } from "next/og";

// Share cards for social links (profiles and challenges): 1200×630 pictures
// in the Night Atlas look. Flexbox only, no emoji and no web fonts, so drawing
// one fetches nothing beyond the data it shows.

export const OG_SIZE = { width: 1200, height: 630 };

/** The avatar colours of app/social.css (--avatar-0…7). */
const AVATAR_HEX = ["#c2304f", "#13773f", "#a86f0c", "#1a62c8", "#6f42c4", "#0e7c72", "#3d5a80", "#b4442a"];
const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const TIER_HEX = ["#d08a4f", "#c3d3e0", "#ffd45c", "#5fe3d0", "#8fb8ff"];

const format = (n: number) => new Intl.NumberFormat("en-US").format(n);

function Frame({ children, eyebrow }: { children: React.ReactNode; eyebrow: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "56px 64px",
        color: "#edfaff",
        background: "radial-gradient(900px 500px at 85% -10%, #123653 0%, #07111f 55%, #01040b 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#4fabf6" }}>WHO · WHEN · WHERE — {eyebrow}</div>
      {children}
    </div>
  );
}

function Disc({ name, avatar, size }: { name: string; avatar: number; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size,
        background: AVATAR_HEX[((avatar % 8) + 8) % 8],
        border: "4px solid rgba(95,216,255,0.55)",
        fontSize: size * 0.48,
        fontWeight: 700,
        color: "#fff",
      }}
    >
      {([...name.trim()][0] ?? "?").toUpperCase()}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "18px 22px",
        borderRadius: 10,
        border: "2px solid rgba(79,171,246,0.3)",
        background: "rgba(10,23,39,0.9)",
      }}
    >
      <div style={{ display: "flex", fontSize: 52, fontWeight: 700 }}>{value}</div>
      <div style={{ display: "flex", fontSize: 22, color: "#a9c6d8", letterSpacing: 2 }}>{label.toUpperCase()}</div>
    </div>
  );
}

export type PlayerCard = {
  name: string;
  username: string;
  avatar: number;
  private?: boolean;
  leagueTier?: number | null;
  stats?: { points: number; streak: number; longest: number; days: number };
};

export function playerCard(player: PlayerCard | null, handle: string): ImageResponse {
  const name = player?.name || `@${handle}`;
  const tier = player?.leagueTier ?? null;
  return new ImageResponse(
    (
      <Frame eyebrow="PLAYER">
        <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 48 }}>
          <Disc name={name} avatar={player?.avatar ?? 3} size={160} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
            <div style={{ display: "flex", fontSize: 32, color: "#a9c6d8", marginTop: 8 }}>@{player?.username ?? handle}</div>
            {tier !== null && (
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: `2px solid ${TIER_HEX[tier] ?? "#d08a4f"}`,
                  color: TIER_HEX[tier] ?? "#d08a4f",
                  fontSize: 26,
                  letterSpacing: 3,
                }}
              >
                {(TIER_NAMES[tier] ?? "Bronze").toUpperCase()} LEAGUE
              </div>
            )}
          </div>
        </div>
        {player?.stats && !player.private ? (
          <div style={{ display: "flex", gap: 18, marginTop: "auto" }}>
            <Stat value={format(player.stats.points)} label="points" />
            <Stat value={format(player.stats.streak)} label="day streak" />
            <Stat value={format(player.stats.longest)} label="longest" />
            <Stat value={format(player.stats.days)} label="days played" />
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: "auto", fontSize: 30, color: "#a9c6d8" }}>
            Daily guessing games about people, places and time.
          </div>
        )}
        <div style={{ display: "flex", marginTop: 24, fontSize: 24, color: "#3ef08a" }}>Add me as a friend and play together →</div>
      </Frame>
    ),
    { ...OG_SIZE, headers: { "Cache-Control": "public, max-age=600" } },
  );
}

export type ChallengeCard = {
  from: { name: string; avatar: number };
  points: number;
  max: number;
  stages: number;
  players: number;
  games: string[];
};

export function challengeCard(challenge: ChallengeCard | null): ImageResponse {
  return new ImageResponse(
    (
      <Frame eyebrow="CHALLENGE">
        {challenge ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 44 }}>
              <Disc name={challenge.from.name} avatar={challenge.from.avatar} size={120} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 60, fontWeight: 700 }}>{challenge.from.name} challenges you</div>
                <div style={{ display: "flex", fontSize: 30, color: "#a9c6d8", marginTop: 6 }}>
                  {challenge.stages} puzzles · {challenge.players} {challenge.players === 1 ? "player" : "players"} so far
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 40 }}>
              <div style={{ display: "flex", fontSize: 130, lineHeight: 1, fontWeight: 700, color: "#ffd45c" }}>
                {format(challenge.points)}
              </div>
              <div style={{ display: "flex", fontSize: 36, color: "#a9c6d8", margin: "0 0 16px 18px" }}>
                of {format(challenge.max)} points. Can you beat it?
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: "auto", flexWrap: "wrap" }}>
              {challenge.games.slice(0, 6).map((game) => (
                <div
                  key={game}
                  style={{
                    display: "flex",
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "2px solid rgba(79,171,246,0.4)",
                    background: "rgba(10,23,39,0.9)",
                    fontSize: 24,
                  }}
                >
                  {game}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: "auto", marginBottom: "auto", fontSize: 72, fontWeight: 700 }}>
            Can you beat my score?
          </div>
        )}
        <div style={{ display: "flex", marginTop: 24, fontSize: 24, color: "#3ef08a" }}>Same puzzles, same rules. Accept the challenge →</div>
      </Frame>
    ),
    { ...OG_SIZE, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
