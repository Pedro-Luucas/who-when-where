import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Showcase } from "./showcase";

// A review page for the Night Atlas UI kit (components/ui) and its tokens
// (app/tokens.css): every component in every variant, in the current theme.
export const metadata: Metadata = {
  title: "UI kit",
  description: "The Night Atlas components and tokens.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <Showcase />
      <SiteFooter />
    </>
  );
}
