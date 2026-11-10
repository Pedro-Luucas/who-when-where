import type { Metadata } from "next";
import { GameActions } from "@/components/game-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DigSite } from "@/games/dig-site/game";

export const metadata: Metadata = {
  title: "Dig Site",
  description:
    "A lost city is buried somewhere on the map. Every dig draws a ring it lies on. Find it in five.",
};

export default function Page() {
  return (
    <>
      <SiteHeader>
        <GameActions />
      </SiteHeader>
      <DigSite />
      <SiteFooter />
    </>
  );
}
