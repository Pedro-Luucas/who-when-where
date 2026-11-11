import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameActions } from "@/components/game-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { GameScreen } from "@/games/platform/screen";
import { GAMES, gameBySlug, isGameSlug } from "@/games/registry";

// Every game's page. The games are listed in games/registry.ts; each one is
// loaded by its own page only (games/loaders.tsx).

export function generateStaticParams() {
  return GAMES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/play/[slug]">): Promise<Metadata> {
  const game = gameBySlug((await params).slug);
  return game ? { title: game.title, description: game.description } : {};
}

export default async function Page({ params }: PageProps<"/play/[slug]">) {
  const { slug } = await params;
  if (!isGameSlug(slug)) notFound();
  return (
    <>
      <SiteHeader>
        <GameActions />
      </SiteHeader>
      <GameScreen game={slug} />
      <SiteFooter />
    </>
  );
}
