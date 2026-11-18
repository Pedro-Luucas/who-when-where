import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ClubScreen } from "@/social/clubs";

export async function generateMetadata({ params }: PageProps<"/club/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/club/[slug]">) {
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

async function Named({ params }: { params: PageProps<"/club/[slug]">["params"] }) {
  const { slug } = await params;
  return <ClubScreen slug={decodeURIComponent(slug)} />;
}
