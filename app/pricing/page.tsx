import type { Metadata } from "next";
import { Pricing } from "@/components/pro/pricing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Who When Where is free to play: today's dailies, streaks, leagues, friends and parties. Pro adds every game, unlimited practice, the whole archive and bigger parties.",
};

/** /pricing: Free and Pro compared, what Pro unlocks, and the questions. No checkout yet. */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <Pricing />
      <SiteFooter />
    </>
  );
}
