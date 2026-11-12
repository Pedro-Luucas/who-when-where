"use client";

import Link from "next/link";
import { Suspense, use, useState } from "react";
import { GameArt } from "@/components/game-art";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { FAMILIES } from "@/games/families";
import { loadBoard } from "@/games/loaders";
import type { GameDefinition } from "@/games/platform/definition";
import type { GameSlug } from "@/games/registry";
import { useDailyResults } from "@/games/results";
import { useFavourites, useToday } from "@/games/today";
import { formatNumber, translator, useLocale } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { useShellT } from "@/lib/shell-messages";
import { TodayChip, plateOf } from "./game-tile";

type Game = GameDefinition<GameSlug>;

/**
 * What the catalogue shows about the selected game: its scene, family and
 * rule, how to play (fetched with the game, which also readies its page),
 * the options, the player's record, and the big Play button. A panel on the
 * right from the lg breakpoint, a bottom sheet below it (see Catalogue).
 */
export function SetupPanel({ game, index, headingId }: { game: Game; index: number; headingId: string }) {
  const t = useShellT();
  const locale = useLocale();
  const { day, of } = useToday();
  const today = of(game.slug);
  const [favourites, toggleFavourite] = useFavourites();
  const favourite = favourites.has(game.slug);
  const [copied, setCopied] = useState(false);
  const tries = game.expedition.tries;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/play/${game.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard refused (an insecure page, a denied permission): nothing to undo.
    }
  }

  return (
    <div className="setup" style={{ "--fam": `var(--color-family-${game.family})` } as React.CSSProperties}>
      <GameArt slug={game.slug} family={game.family} caption={game.theme[locale]} className="setup-art" />

      <div className="setup-head">
        <p className="tile-meta">
          <b>{FAMILIES[game.family].name[locale]}</b> {plateOf(index)} · {t(`engine_${game.engine}`)}
        </p>
        <h2 id={headingId}>{game.title}</h2>
        <p className="setup-blurb">{game.blurb[locale]}</p>
      </div>

      <section className="setup-section">
        <h3>
          <Icon name="help" /> {t("howToPlay")}
        </h3>
        <Suspense fallback={<Skeleton className="h-20" />}>
          <HowToPlay slug={game.slug} />
        </Suspense>
      </section>

      <section className="setup-section">
        <h3>
          <Icon name="sliders" /> {t("options")}
        </h3>
        <dl className="setup-options">
          <div>
            <dt>{t("mode")}</dt>
            <dd>
              <span className="setup-mode" aria-current="true">
                {t("modeDaily")}
                {day > 0 && <small>{t("puzzleOfDay", { n: day })}</small>}
              </span>
              <Link href={`/play/${game.slug}/practice`} className="setup-mode">
                {t("modePractice")}
                <small>{t("modePracticeShort")}</small>
              </Link>
              <Link href="/expedition" className="setup-mode">
                {t("modeCustom")}
                <small>{t("modeCustomNote")}</small>
              </Link>
            </dd>
          </div>
          {tries && (
            <div>
              <dt>{t("tries")}</dt>
              <dd className="setup-value">{tries.presets.standard}</dd>
            </div>
          )}
          <div>
            <dt>{t("filterToday")}</dt>
            <dd>
              <TodayChip today={today} />
            </dd>
          </div>
        </dl>
      </section>

      <Record slug={game.slug} />

      <footer className="setup-foot">
        <div className="setup-foot-row">
          <button type="button" className="key key-secondary key-sm" aria-pressed={favourite} onClick={() => toggleFavourite(game.slug)}>
            <Icon name="star" size={16} className={favourite ? "text-pro" : undefined} />
            {t("favourite")}
          </button>
          <button type="button" className="key key-secondary key-sm" onClick={copyLink}>
            <Icon name="link" size={16} />
            <span aria-live="polite">{t(copied ? "linkCopied" : "copyLink")}</span>
          </button>
        </div>
        <ButtonLink href={`/play/${game.slug}`} variant="play" size="lg" wide icon={<Icon name="play" size={18} />}>
          {t(today.state === "done" ? "seeResult" : today.state === "started" ? "continue" : "play")}
        </ButtonLink>
      </footer>
    </div>
  );
}

/** The rules, from the game itself. Fetching it readies the game's page too. */
function HowToPlay({ slug }: { slug: GameSlug }) {
  const board = use(loadBoard(slug));
  const locale = useLocale();
  const help = board.daily(translator(board.messages, locale)).help;
  return (
    <ol className="help-list setup-help">
      {help.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ol>
  );
}

/** The player's finished daily puzzles in this game. */
function Record({ slug }: { slug: GameSlug }) {
  const t = useShellT();
  const locale = useLocale();
  const results = useDailyResults().filter((result) => result.game === slug);
  const played = results.length;
  const average = played ? Math.round(results.reduce((sum, result) => sum + result.points, 0) / played) : 0;
  const best = played ? Math.max(...results.map((result) => result.points)) : 0;
  return (
    <section className="setup-section">
      <h3>
        <Icon name="chart" /> {t("yourRecord")}
      </h3>
      {played ? (
        <dl className="setup-record">
          <div>
            <dt>{t("recordPlayed")}</dt>
            <dd>{formatNumber(played, locale)}</dd>
          </div>
          <div>
            <dt>{t("recordAverage")}</dt>
            <dd>{formatNumber(average, locale)}</dd>
          </div>
          <div>
            <dt>{t("recordBest")}</dt>
            <dd>
              {formatNumber(best, locale)}
              <small>/{formatNumber(MAX_POINTS, locale)}</small>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="hint">{t("recordNone")}</p>
      )}
      <p className="setup-chips">
        <Chip tone="success">{t("tierFree")}</Chip>
        <Chip tone="accent">{t("tierDaily")}</Chip>
      </p>
    </section>
  );
}
