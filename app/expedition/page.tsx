import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SoloExpedition } from "@/expedition/solo";

export const metadata: Metadata = {
  title: "Expedition",
  description:
    "A game of your own making: puzzles from every game, one after the other. Choose the games, the clock and the difficulty.",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <SoloExpedition />
      <SiteFooter />
    </>
  );
}
