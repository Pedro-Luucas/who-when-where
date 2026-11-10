"use client";

import Link from "next/link";
import type { GameInfo } from "@/games/registry";
import { useLocale } from "@/lib/i18n";

/** One game on the hub. Only plain data crosses in from the server page. */
export function GameCard({
  game,
  index,
  children,
}: {
  game: Pick<GameInfo, "slug" | "title" | "theme" | "blurb">;
  /** Position on the hub, shown as a plate number. */
  index: number;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <Link href={`/${game.slug}`} className="game-card">
      <span className="game-card-theme">
        <i>{String(index + 1).padStart(2, "0")}</i>
        {game.theme[locale]}
      </span>
      <h3>{game.title}</h3>
      <p>{game.blurb[locale]}</p>
      <div className="game-card-foot">{children}</div>
    </Link>
  );
}
