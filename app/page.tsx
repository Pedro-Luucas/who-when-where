import { DailiesStrip } from "@/components/catalogue/dailies";
import { HomeHero } from "@/components/home/hero";
import { GamesGrid, WaysToPlay } from "@/components/home/ways";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * The home page: a landing for guests (or a dashboard once signed in), today's
 * dailies, the ways to play, and every game.
 */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="shell-page home">
        <HomeHero />
        <DailiesStrip />
        <WaysToPlay />
        <GamesGrid />
      </main>
      <SiteFooter />
    </>
  );
}
