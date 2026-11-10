import type { Metadata } from "next";
import { AccountPage } from "@/account/account-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in to keep your games and streaks, and play on any device.",
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <SiteHeader />
      <AccountPage />
      <SiteFooter />
    </>
  );
}
