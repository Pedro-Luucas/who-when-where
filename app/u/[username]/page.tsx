import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cleanHandle } from "@/lib/server-api";
import { PlayerProfile } from "@/social/profile";

// A player's public profile: /u/<username>. The page is a shell; the profile
// itself is read from the accounts API in the browser (it depends on who is
// looking: friends-only profiles, the add-friend button). Its preview in a
// chat is the card drawn by ./opengraph-image.tsx.

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const handle = cleanHandle((await params).username) ?? "player";
  const title = `@${handle}`;
  const description = `@${handle} on Who When Where: scores, streaks, league and a year of daily play.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

async function Named({ params }: { params: PageProps<"/u/[username]">["params"] }) {
  const { username } = await params;
  return <PlayerProfile username={cleanHandle(username) ?? decodeURIComponent(username)} />;
}

export default function Page({ params }: PageProps<"/u/[username]">) {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="page">
            <div className="page-skeleton skeleton-block" aria-busy="true" />
          </main>
        }
      >
        <Named params={params} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
