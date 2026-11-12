import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { FamilyId } from "@/games/families";
import { gameBySlug, isGameSlug } from "@/games/registry";
import { dateOfDay } from "@/lib/daily";
import { MAX_POINTS } from "@/lib/points";
import { readRecap, recapTotal } from "@/lib/recap";

// The share card of a day of the dailies: a 1200×630 picture drawn from the
// recap link's parameters (lib/recap.ts). The recap page names it as its
// Open Graph image, so a pasted link unfurls into it; the daily page offers it
// as a download. Flexbox only, and no emoji, so drawing it fetches nothing.

// The family colours of app/tokens.css (the card cannot read CSS variables).
const FAMILY_HEX: Record<FamilyId, string> = {
  who: "#f472b6",
  when: "#b07cff",
  where: "#4fabf6",
  shapes: "#2dd4bf",
  flags: "#818cf8",
  words: "#5fd8ff",
  numbers: "#ffd45c",
};

const WORDS = {
  en: { daily: "DAILY", of: "of", pts: "points", streak: "day streak", notPlayed: "not played", done: "done", cta: "Play today’s puzzles" },
  pt: { daily: "DIÁRIO", of: "de", pts: "pontos", streak: "dias seguidos", notPlayed: "não jogado", done: "feitos", cta: "Jogue os desafios de hoje" },
};

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const recap = readRecap((name) => search.get(name), isGameSlug);
  if (!recap) return new Response("Not a recap", { status: 400 });

  const words = WORDS[recap.locale];
  const number = recap.locale === "pt" ? "pt-BR" : "en-US";
  const format = (n: number) => new Intl.NumberFormat(number).format(n);
  const date = new Intl.DateTimeFormat(number, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    dateOfDay(recap.day),
  );
  const total = recapTotal(recap);

  return new ImageResponse(
    (
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#4fabf6" }}>
              WHO · WHEN · WHERE — {words.daily} #{recap.day}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "#a9c6d8", marginTop: 6 }}>{date}</div>
          </div>
          {recap.streak > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 24px",
                borderRadius: 999,
                border: "2px solid rgba(255,212,92,0.6)",
                background: "rgba(255,212,92,0.12)",
                color: "#ffd45c",
                fontSize: 30,
              }}
            >
              {format(recap.streak)} {words.streak}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 34 }}>
          <div style={{ display: "flex", fontSize: 120, lineHeight: 1, fontWeight: 700 }}>{format(total.points)}</div>
          <div style={{ display: "flex", fontSize: 34, color: "#a9c6d8", margin: "0 0 14px 18px" }}>
            {words.of} {format(total.max)} {words.pts} · {total.done}/{recap.scores.length} {words.done}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: "auto" }}>
          {recap.scores.map(({ game, points }) => {
            const definition = gameBySlug(game);
            const color = definition ? FAMILY_HEX[definition.family] : "#4fabf6";
            const share = points === null ? 0 : points / MAX_POINTS;
            return (
              <div
                key={game}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  padding: "18px 18px 20px",
                  borderRadius: 10,
                  border: `2px solid ${points === null ? "rgba(79,171,246,0.25)" : color}`,
                  background: "rgba(10,23,39,0.9)",
                }}
              >
                <div style={{ display: "flex", height: 6, width: 48, borderRadius: 3, background: color }} />
                <div style={{ display: "flex", fontSize: 24, marginTop: 14, color: "#edfaff" }}>{definition?.title ?? game}</div>
                <div style={{ display: "flex", fontSize: 40, marginTop: 8, color: points === null ? "#6f91a7" : "#edfaff" }}>
                  {points === null ? "—" : format(points)}
                </div>
                <div style={{ display: "flex", fontSize: 18, color: "#6f91a7" }}>
                  {points === null ? words.notPlayed : `/ ${format(MAX_POINTS)}`}
                </div>
                <div style={{ display: "flex", height: 8, marginTop: 14, borderRadius: 4, background: "rgba(79,171,246,0.18)" }}>
                  <div style={{ display: "flex", width: `${Math.round(share * 100)}%`, borderRadius: 4, background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", marginTop: 26, fontSize: 22, color: "#3ef08a" }}>{words.cta} →</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // A recap never changes: the same link is the same picture.
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
