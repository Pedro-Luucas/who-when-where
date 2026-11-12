import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { InboxPage } from "@/social/inbox";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Challenges, friend requests and messages from your friends.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <InboxPage />
      <SiteFooter />
    </>
  );
}
