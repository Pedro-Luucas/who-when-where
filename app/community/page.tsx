import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Community } from "@/social/community";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Add friends, see who is online and chat with everyone who plays.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <Community />
      <SiteFooter />
    </>
  );
}
