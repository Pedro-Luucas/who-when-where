import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PlayerProfile } from "@/social/profile";

export const metadata: Metadata = {
  title: "Player",
  description:
    "A player's scores, streaks and year of daily play.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <PlayerProfile />
      <SiteFooter />
    </>
  );
}
