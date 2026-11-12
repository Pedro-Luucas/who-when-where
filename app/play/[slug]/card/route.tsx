import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { FamilyId } from "@/games/families";
import { gameBySlug } from "@/games/registry";
import { readCard, type CardVerdict } from "@/lib/result-share";

// The share card of one finished puzzle: a 1200×630 picture drawn from the
// address's parameters (lib/result-share.ts) — the game, its family colour,
// the score and how each try went, as squares. Spoiler free, like the share
// text. The result card offers it to save or send (components/play/share-card.tsx).
// Flexbox only, and no emoji, so drawing it fetches nothing.

// The family colours of app/tokens.css (the picture cannot read CSS variables).
const FAMILY_HEX: Record<FamilyId, string> = {
  who: "#f472b6",
  when: "#b07cff",
  where: "#4fabf6",
  shapes: "#2dd4bf",
  flags: "#818cf8",
  words: "#5fd8ff",
  numbers: "#ffd45c",
};

const SQUARE: Record<CardVerdict, string> = {
  hit: "#3ef08a",
  near: "#ffd45c",
  miss: "#ff466d",
  skip: "#2a3d55",
};

const WORDS = {
  en: { of: "of 1,000 points", cta: "Can you beat it? Play today’s puzzle", great: "Brilliant", good: "Well played", fair: "Not bad", poor: "A tough one" },
  pt: { of: "de 1.000 pontos", cta: "Consegue fazer melhor? Jogue o desafio de hoje", great: "Brilhante", good: "Bem jogado", fair: "Nada mal", poor: "Essa foi difícil" },
};

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const game = gameBySlug(slug);
  const card = readCard((name) => request.nextUrl.searchParams.get(name));
  if (!game || !card) return new Response("Not a share card", { status: 400 });

  const words = WORDS[card.locale];
  const color = FAMILY_HEX[game.family] ?? "#4fabf6";
  const points = new Intl.NumberFormat(card.locale === "pt" ? "pt-BR" : "en-US").format(card.points);
  const verdict = card.points >= 900 ? words.great : card.points >= 650 ? words.good : card.points >= 300 ? words.fair : words.poor;
  // Big squares for a few tries, smaller ones for a long run (they share a 380px-wide panel).
  const n = card.verdicts.length;
  const size = n <= 6 ? 52 : n <= 12 ? 40 : n <= 20 ? 32 : 26;
  const share = card.points / 1000;
  const ring = { size: 230, stroke: 20 };
  const radius = (ring.size - ring.stroke) / 2;
  const around = 2 * Math.PI * radius;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "52px 64px 44px",
          color: "#edfaff",
          background: `radial-gradient(900px 560px at 92% -10%, ${color}38 0%, #07111f 50%, #01040b 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flex: 1, gap: 48 }}>
          {/* Left: the game, the puzzle, the verdict and the score. */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", height: 8, width: 120, borderRadius: 4, background: color }} />
            <div style={{ display: "flex", fontSize: 66, marginTop: 24, lineHeight: 1.05 }}>{game.title}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#a9c6d8", marginTop: 10 }}>{card.label}</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
              <div style={{ display: "flex", fontSize: 34, color }}>{verdict}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <div style={{ display: "flex", fontSize: 150, lineHeight: 1, letterSpacing: -4 }}>{points}</div>
                <div style={{ display: "flex", fontSize: 30, color: "#a9c6d8", marginBottom: 18 }}>{words.of}</div>
              </div>
            </div>
          </div>

          {/* Right: the score as a ring, how each try went as squares. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 430,
              padding: "30px 24px 28px",
              borderRadius: 18,
              border: `2px solid ${color}55`,
              background: "rgba(10,23,39,0.82)",
            }}
          >
            <div style={{ display: "flex", position: "relative", width: ring.size, height: ring.size }}>
              <svg width={ring.size} height={ring.size} viewBox={`0 0 ${ring.size} ${ring.size}`}>
                <circle cx={ring.size / 2} cy={ring.size / 2} r={radius} fill="none" stroke="#1b2d44" strokeWidth={ring.stroke} />
                {share > 0 && (
                  <circle
                    cx={ring.size / 2}
                    cy={ring.size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={ring.stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${share * around} ${around}`}
                    transform={`rotate(-90 ${ring.size / 2} ${ring.size / 2})`}
                  />
                )}
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: ring.size,
                  height: ring.size,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 54,
                }}
              >
                {Math.round(share * 100)}%
              </div>
            </div>
            {n > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: "auto" }}>
                {card.verdicts.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      width: size,
                      height: size,
                      borderRadius: Math.round(size / 5),
                      background: SQUARE[v],
                      border: v === "skip" ? "2px solid #3d5675" : "2px solid rgba(255,255,255,0.14)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 30 }}>
          <div style={{ display: "flex", fontSize: 26, color: "#3ef08a" }}>{words.cta} →</div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: "#4fabf6" }}>WHO · WHEN · WHERE</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // The same address is always the same picture.
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
