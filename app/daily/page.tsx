import type { Metadata } from "next";
import { DailyBoard } from "@/components/catalogue/daily-board";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DailyPanel } from "@/social/daily-panel";

export const metadata: Metadata = {
  title: "Daily games",
  description: "Today's puzzles in every Who When Where game — the same for everybody — with your streak, level and year of play.",
};

/** /daily: today's puzzle in every game, the day's progress, and the daily challenge (streak, level, year). */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="shell-page">
        <DailyBoard />
        <DailyPanel />
      </main>
      <SiteFooter />
    </>
  );
}
