import type { Metadata } from "next";
import { GameActions } from "@/components/game-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Wayfarer } from "@/games/wayfarer/game";

export const metadata: Metadata = {
  title: "Wayfarer",
  description:
    "One famous journey a day, traced on the map a stretch at a time. Can you name it in six tries?",
};

export default function Page() {
  return (
    <>
      <SiteHeader>
        <GameActions />
      </SiteHeader>
      <Wayfarer />
      <SiteFooter />
    </>
  );
}
