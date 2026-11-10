import type { Metadata } from "next";
import { GameActions } from "@/components/game-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Overland } from "@/games/overland/game";

export const metadata: Metadata = {
  title: "Overland",
  description:
    "Two countries, and everything that lies between them. Name the countries that join them, border to border.",
};

export default function Page() {
  return (
    <>
      <SiteHeader>
        <GameActions />
      </SiteHeader>
      <Overland />
      <SiteFooter />
    </>
  );
}
