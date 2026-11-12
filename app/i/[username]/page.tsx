import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cleanHandle } from "@/lib/server-api";
import { InvitePage } from "@/social/invite-page";

// An invitation link: /i/<username>. Whoever signs up after opening it becomes
// the inviter's friend straight away (api/src/app.ts, welcomeInvited).

export async function generateMetadata({ params }: PageProps<"/i/[username]">): Promise<Metadata> {
  const handle = cleanHandle((await params).username) ?? "a friend";
  const title = `@${handle} invited you to Who When Where`;
  const description = "Daily guessing games about people, places and time. Play today's puzzles together.";
  return { title, description, robots: { index: false }, openGraph: { title, description } };
}

async function Invite({ params }: { params: PageProps<"/i/[username]">["params"] }) {
  const { username } = await params;
  return <InvitePage username={cleanHandle(username) ?? ""} />;
}

export default function Page({ params }: PageProps<"/i/[username]">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="page page-narrow" aria-busy="true" />}>
        <Invite params={params} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
