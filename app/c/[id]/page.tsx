import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ChallengePage } from "@/social/challenge-page";

// A challenge link: /c/<id>. Who sent it and their score, the same puzzles to
// play, then the head-to-head and the board. Its preview in a chat is the card
// drawn by ./opengraph-image.tsx.

const cleanId = (value: string) => (/^[A-Za-z0-9]{4,16}$/.test(value) ? value : "");

export const metadata: Metadata = {
  title: "Challenge",
  description: "Same puzzles, same rules: can you beat their score on Who When Where?",
  robots: { index: false },
};

async function Challenge({ params }: { params: PageProps<"/c/[id]">["params"] }) {
  const { id } = await params;
  return <ChallengePage id={cleanId(id)} />;
}

export default function Page({ params }: PageProps<"/c/[id]">) {
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
        <Challenge params={params} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
