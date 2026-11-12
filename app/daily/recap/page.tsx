import type { Metadata } from "next";
import { Suspense } from "react";
import { RecapView } from "@/components/catalogue/recap-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isGameSlug } from "@/games/registry";
import { readRecap, recapQuery, recapTotal } from "@/lib/recap";

// Where a shared day of the dailies lands: the card (app/daily/card) and the
// way in to today's puzzles. The link carries the whole day (lib/recap.ts), so
// its preview in a chat is the card itself.

type Search = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function recapOf(searchParams: Search) {
  const search = await searchParams;
  return readRecap((name) => first(search[name]), isGameSlug);
}

export async function generateMetadata({ searchParams }: PageProps<"/daily/recap">): Promise<Metadata> {
  const recap = await recapOf(searchParams);
  if (!recap) return { title: "Daily games", robots: { index: false } };
  const { points, max } = recapTotal(recap);
  const title =
    recap.locale === "pt"
      ? `Desafio diário #${recap.day} · ${points.toLocaleString("pt-BR")}/${max.toLocaleString("pt-BR")}`
      : `Daily #${recap.day} · ${points.toLocaleString("en-US")}/${max.toLocaleString("en-US")}`;
  const description =
    recap.locale === "pt"
      ? `${recap.scores.length} desafios por dia, os mesmos para todo mundo. Consegue fazer melhor?`
      : `${recap.scores.length} puzzles a day, the same for everybody. Can you beat it?`;
  const image = { url: `/daily/card?${recapQuery(recap)}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

async function Recap({ searchParams }: { searchParams: Search }) {
  const recap = await recapOf(searchParams);
  return <RecapView query={recap ? recapQuery(recap) : null} />;
}

export default function Page({ searchParams }: PageProps<"/daily/recap">) {
  return (
    <>
      <SiteHeader />
      <main className="shell-page recap-page">
        <Suspense fallback={<div className="recap-card skeleton-block" aria-busy="true" />}>
          <Recap searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
