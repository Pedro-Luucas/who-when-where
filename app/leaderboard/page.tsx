import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Leaderboard } from "@/social/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "The best scores of the day, the week and all time, among everyone or just your friends.",
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <Leaderboard />
      <SiteFooter />
    </>
  );
}
