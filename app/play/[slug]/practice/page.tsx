import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PracticeScreen } from "@/games/platform/practice";
import { GAMES, gameBySlug, isGameSlug } from "@/games/registry";

// Every game's practice page: unlimited puzzles dealt at random, which never
// count towards the daily challenge (games/platform/practice.tsx).

export function generateStaticParams() {
  return GAMES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/play/[slug]/practice">): Promise<Metadata> {
  const game = gameBySlug((await params).slug);
  return game ? { title: `${game.title} · Practice`, description: game.description } : {};
}

export default async function Page({ params }: PageProps<"/play/[slug]/practice">) {
  const { slug } = await params;
  if (!isGameSlug(slug)) notFound();
  return (
    <>
      <SiteHeader />
      <PracticeScreen game={slug} />
      <SiteFooter />
    </>
  );
}
