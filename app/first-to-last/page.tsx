import type { Metadata } from "next";
import { GameActions } from "@/components/game-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FirstToLast } from "@/games/first-to-last/game";

export const metadata: Metadata = {
  title: "First to Last",
  description:
    "Six moments in history, pinned where they happened. Put them in order, earliest first.",
};

export default function Page() {
  return (
    <>
      <SiteHeader>
        <GameActions />
      </SiteHeader>
      <FirstToLast />
      <SiteFooter />
    </>
  );
}
