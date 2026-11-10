"use client";

import Link from "next/link";
import type { GameInfo } from "@/games/registry";
import { useLocale } from "@/lib/i18n";

/** One game on the hub. Only plain data crosses in from the server page. */
export function GameCard({
  game,
  children,
}: {
  game: Pick<GameInfo, "slug" | "title" | "blurb">;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <Link href={`/${game.slug}`} className="game-card">
      <h3>{game.title}</h3>
      <p>{game.blurb[locale]}</p>
      <div className="game-card-foot">{children}</div>
    </Link>
  );
}
