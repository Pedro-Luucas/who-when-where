import type { Metadata } from "next";
import { DailyBoard } from "@/components/catalogue/daily-board";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CHALLENGE_GAMES } from "@/games/registry";

export const metadata: Metadata = {
  title: "Daily games",
  description: `Today's dailies — ${CHALLENGE_GAMES.map((game) => game.title).join(", ")} — the same for everybody, new every day at 00:00 UTC. Keep your streak going and replay the archive.`,
};

/** /daily: today's five dailies, the streak dial, the archive calendar and the year of play. */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="shell-page shell-page-wide">
        <DailyBoard />
      </main>
      <SiteFooter />
    </>
  );
}
