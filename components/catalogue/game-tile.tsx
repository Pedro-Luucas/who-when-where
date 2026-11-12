"use client";

import Link from "next/link";
import { useEntitlements } from "@/account/entitlements";
import { GameArt } from "@/components/game-art";
import { ProChip } from "@/components/pro/pro-chip";
import { Icon } from "@/components/shell/nav-items";
import { Chip } from "@/components/ui/chip";
import { FAMILIES } from "@/games/families";
import type { GameDefinition } from "@/games/platform/definition";
import type { GameSlug } from "@/games/registry";
import type { Today } from "@/games/today";
import { formatNumber, useLocale } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { useShellT } from "@/lib/shell-messages";

type Game = GameDefinition<GameSlug>;

/** "#01": a game's plate number in the catalogue. */
export const plateOf = (index: number) => `#${String(index + 1).padStart(2, "0")}`;

/** How a game stands today, as a chip: done with its points, in progress, or a daily still to play. */
export function TodayChip({ today }: { today: Today }) {
  const t = useShellT();
  const locale = useLocale();
  if (today.state === "done") {
    return (
      <Chip tone="success" icon={<span aria-hidden="true">✓</span>}>
        {formatNumber(today.points ?? 0, locale)}/{formatNumber(MAX_POINTS, locale)}
      </Chip>
    );
  }
  if (today.state === "started") return <Chip tone="accent">{t("inProgress")}</Chip>;
  return <Chip>{t("tierDaily")}</Chip>;
}

type TileProps = {
  game: Game;
  index: number;
  today: Today;
  /** A tile that selects (the catalogue) rather than opens the game (the home page). */
  onSelect?: () => void;
  selected?: boolean;
  favourite?: { on: boolean; toggle: () => void };
};

/** One game in a grid: its scene, family and plate, title, rule, and how it stands today. */
export function GameTile({ game, index, today, onSelect, selected, favourite }: TileProps) {
  const t = useShellT();
  const locale = useLocale();
  const { has } = useEntitlements();
  const pro = game.tier === "pro";
  const body = (
    <>
      <GameArt slug={game.slug} family={game.family} caption={game.theme[locale]} className="tile-art" />
      <span className="tile-meta">
        <b>{FAMILIES[game.family].name[locale]}</b> {plateOf(index)}
      </span>
      <span className="tile-title">{game.title}</span>
      <span className="tile-blurb">{game.blurb[locale]}</span>
      <span className="tile-foot">
        {pro && <ProChip locked={!has("games.pro")} />}
        <TodayChip today={today} />
        {today.state === "done" && <span className="tile-done">{t("doneToday")}</span>}
      </span>
    </>
  );
  return (
    <article
      className="tile"
      data-family={game.family}
      data-selected={selected ? "" : undefined}
      style={{ "--fam": `var(--color-family-${game.family})` } as React.CSSProperties}
    >
      {onSelect ? (
        <button type="button" className="tile-hit" onClick={onSelect} aria-pressed={selected}>
          {body}
        </button>
      ) : (
        <Link href={`/play/${game.slug}`} className="tile-hit">
          {body}
        </Link>
      )}
      {favourite && (
        <button
          type="button"
          className="tile-star"
          aria-pressed={favourite.on}
          aria-label={t(favourite.on ? "removeFavourite" : "addFavourite", { game: game.title })}
          title={t("favourite")}
          onClick={favourite.toggle}
        >
          <Icon name="star" size={17} />
        </button>
      )}
    </article>
  );
}
