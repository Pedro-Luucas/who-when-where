import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WeeklyPage } from "@/social/weekly";

export const metadata: Metadata = {
  title: "Weekly Special",
  description: "One longer run of puzzles a week, the same for everybody, with its own leaderboard. One try each.",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <WeeklyPage />
      <SiteFooter />
    </>
  );
}
