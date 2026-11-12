import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LeaguePage } from "@/social/league";

export const metadata: Metadata = {
  title: "Weekly league",
  description:
    "Compete each week against up to 30 players at your level. Every daily point counts; the top moves up a tier, from Bronze to Diamond.",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <LeaguePage />
      <SiteFooter />
    </>
  );
}
