import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PartyPage } from "@/party/party-page";

export const metadata: Metadata = {
  title: "Party",
  description:
    "Open a room, invite friends and race through the same puzzles, with live standings and chat.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <PartyPage />
      <SiteFooter />
    </>
  );
}
