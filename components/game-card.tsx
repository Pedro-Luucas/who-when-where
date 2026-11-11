"use client";

import Link from "next/link";
import { FAMILIES } from "@/games/families";
import type { GameInfo } from "@/games/registry";
import { useLocale } from "@/lib/i18n";
import { FamilyIcon } from "./ui/family-icon";

/** One game on the hub: art in its family colour, family, title, rule, today's status. */
export function GameCard({
  game,
  index,
  children,
}: {
  game: Pick<GameInfo, "slug" | "title" | "theme" | "blurb" | "family">;
  /** Position on the hub, shown as a plate number. */
  index: number;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <Link href={`/${game.slug}`} className="game-card" data-family={game.family}>
      <span className="game-card-art" aria-hidden="true">
        <b>#{String(index + 1).padStart(2, "0")}</b>
        <FamilyIcon family={game.family} />
      </span>
      <span className="game-card-theme">
        <i>{FAMILIES[game.family].name[locale]}</i>
        {game.theme[locale]}
      </span>
      <h3>{game.title}</h3>
      <p>{game.blurb[locale]}</p>
      <div className="game-card-foot">{children}</div>
    </Link>
  );
}
