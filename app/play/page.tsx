import type { Metadata } from "next";
import { Catalogue } from "@/components/catalogue/catalogue";
import { DailiesStrip } from "@/components/catalogue/dailies";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "All games",
  description:
    "Every Who When Where game: famous lives, great journeys, lost cities, borders, outlines and the order of history. A new puzzle in each, every day.",
};

/** /play: today's dailies, then the whole catalogue with its setup panel. */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="shell-page shell-page-wide">
        <DailiesStrip />
        <Catalogue />
      </main>
      <SiteFooter />
    </>
  );
}
