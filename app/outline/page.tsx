import type { Metadata } from "next";
import { GameActions } from "@/components/game-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Outline } from "@/games/outline/game";

export const metadata: Metadata = {
  title: "Outline",
  description:
    "A country, cut out of the map. Every miss tells you how far away it is, and which way. Name it in six.",
};

export default function Page() {
  return (
    <>
      <SiteHeader>
        <GameActions />
      </SiteHeader>
      <Outline />
      <SiteFooter />
    </>
  );
}
