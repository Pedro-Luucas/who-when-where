import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Logbook } from "@/logbook/logbook-page";

export const metadata: Metadata = {
  title: "Logbook",
  description: "Your level, your achievements and an atlas of everything your puzzles have revealed.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <Logbook />
      <SiteFooter />
    </>
  );
}
