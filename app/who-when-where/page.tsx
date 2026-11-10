import type { Metadata } from "next";
import { GameActions } from "@/components/game-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhoWhenWhere } from "@/games/who-when-where/game";

export const metadata: Metadata = {
  title: "Who When Where",
  description:
    "One famous mind a day. Guess where and when they were born — and where and when they died.",
};

export default function Page() {
  return (
    <>
      <SiteHeader>
        <GameActions />
      </SiteHeader>
      <WhoWhenWhere />
      <SiteFooter />
    </>
  );
}
