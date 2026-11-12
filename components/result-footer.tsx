"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Icon } from "@/components/shell/nav-items";
import { useDailyResults } from "@/games/results";
import { CHALLENGE_SLUGS, GAME_THEMES, GAME_TITLES, inChallenge, type GameSlug } from "@/games/registry";
import { useDayNumber, useSecondsUntilTomorrow } from "@/lib/clock";
import { useLocale, useSiteT } from "@/lib/i18n";
import { useIsMobile } from "@/lib/media";
import { useShellT } from "@/lib/shell-messages";
import { ShareButton } from "./share-button";

const clock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

type ActionsProps = {
  /** Builds the spoiler-free text to share; `url` is this game's address. */
  shareText: (url: string) => string;
  /** The game that was played. */
  game: GameSlug;
  /** Overrides "Next puzzle in". */
  nextLabel?: string;
  /** A past day played from the archive: the way back to it, in place of today's trail. */
  archive?: boolean;
};

/**
 * What every finished daily puzzle ends with: a share button, the countdown,
 * unlimited practice, and the way on to the next of today's puzzles.
 *
 * On phones the two things a thumb wants next — share, and the next puzzle —
 * sit in a dock along the bottom edge (ResultDock), so the score, the review
 * and the map can be as long as they like above it.
 */
export function ResultActions({ shareText, game, nextLabel, archive }: ActionsProps) {
  const t = useSiteT();
  const shell = useShellT();
  const secondsLeft = useSecondsUntilTomorrow();
  const phone = useIsMobile();
  const next = useNextDaily(game);
  const share = () => shareText(`${window.location.origin}/play/${game}`);

  if (archive) {
    return (
      <div className="summary-actions">
        {phone ? (
          <ResultDock share={share} href={`/play/${game}`} label={shell("todaysPuzzle")} />
        ) : (
          <ShareButton label={t("share")} text={share} />
        )}
        <p className="hint">{shell("archiveNote")}</p>
        <Link href="/daily#archive" className="key key-secondary key-sm">
          {shell("backToArchive")}
        </Link>
        <Link href={`/play/${game}`} className="key key-sm">
          {shell("todaysPuzzle")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="summary-actions">
        {phone ? (
          <ResultDock
            share={share}
            href={next ? `/play/${next}` : "/daily"}
            label={next ? GAME_TITLES[next] : t("dayDoneCta")}
            hint={next ? t("upNext") : undefined}
          />
        ) : (
          <ShareButton label={t("share")} text={share} />
        )}
        <p className="countdown">
          <span>{nextLabel ?? t("nextIn")}</span>
          <time>{clock(secondsLeft)}</time>
        </p>
        <Link href={`/play/${game}/practice`} className="key key-secondary key-sm">
          {shell("practicePlay")}
        </Link>
      </div>
      <NextUp current={game} />
    </>
  );
}

/** The next of today's dailies not yet finished, after `current` and wrapping round; undefined once all are done. */
function useNextDaily(current: GameSlug): GameSlug | undefined {
  const today = useDayNumber();
  const results = useDailyResults();
  const done = new Set(results.filter((result) => result.day === today && inChallenge(result.game)).map((result) => result.game));
  const at = CHALLENGE_SLUGS.indexOf(current);
  return [...CHALLENGE_SLUGS.slice(at + 1), ...CHALLENGE_SLUGS.slice(0, Math.max(at, 0))].find((game) => !done.has(game));
}

/**
 * The phone's result dock: Share and the way onwards, pinned to the bottom
 * edge. Rendered on <body>, so no animated ancestor can move it.
 */
function ResultDock({ share, href, label, hint }: { share: () => string; href: string; label: string; hint?: string }) {
  const t = useSiteT();
  return createPortal(
    <div className="result-dock" role="group" aria-label={t("backToToday")}>
      <ShareButton label={t("share")} text={share} className="key key-secondary result-dock-share" />
      <Link href={href} className="key key-play result-dock-next">
        <span>
          {hint && <small>{hint}</small>}
          <b>{label}</b>
        </span>
        <Icon name="chevron" size={18} />
      </Link>
    </div>,
    document.body,
  );
}

/**
 * Today's other puzzles: a trail of the dailies, and a link to the next one not
 * yet finished (after this one, wrapping round) — or, once all are done, to
 * /daily, where the whole day can be shared.
 */
function NextUp({ current }: { current: GameSlug }) {
  const t = useSiteT();
  const locale = useLocale();
  const today = useDayNumber();
  const results = useDailyResults();

  const done = new Set(results.filter((result) => result.day === today && inChallenge(result.game)).map((result) => result.game));
  const total = CHALLENGE_SLUGS.length;
  // A game outside the daily challenge leads to its first puzzle not yet played.
  const at = CHALLENGE_SLUGS.indexOf(current);
  const next = [...CHALLENGE_SLUGS.slice(at + 1), ...CHALLENGE_SLUGS.slice(0, Math.max(at, 0))].find((game) => !done.has(game));
  const progress = t("dayProgress", { n: done.size, total });

  return (
    <nav className="next-up" aria-label={t("backToToday")} data-complete={next ? undefined : ""}>
      <div className="next-up-head">
        <span className="eyebrow">{progress}</span>
        <ol className="next-up-trail" aria-hidden="true">
          {CHALLENGE_SLUGS.map((game) => (
            <li
              key={game}
              title={GAME_TITLES[game]}
              data-done={done.has(game) ? "" : undefined}
              data-current={game === current ? "" : undefined}
            />
          ))}
        </ol>
      </div>
      {next ? (
        <Link href={`/play/${next}`} className="next-up-link">
          <span>
            <small>
              {t("upNext")} · {GAME_THEMES[next][locale]}
            </small>
            <b>{GAME_TITLES[next]}</b>
          </span>
          <i aria-hidden="true">→</i>
        </Link>
      ) : (
        <Link href="/daily" className="next-up-link">
          <span>
            <small>{t("dayDone", { n: total })}</small>
            <b>{t("dayDoneCta")}</b>
          </span>
          <i aria-hidden="true">→</i>
        </Link>
      )}
    </nav>
  );
}

type ReadMoreProps = { text: string; href: string; credit?: string };

/** The closing paragraph from Wikipedia, with a link to the article. */
export function ReadMore({ text, href, credit }: ReadMoreProps) {
  const t = useSiteT();
  return (
    <article className="bio">
      <p>{text}</p>
      <p className="bio-links">
        <a href={href} target="_blank" rel="noreferrer">
          {t("readMore")} →
        </a>
        {credit && <span>{credit}</span>}
      </p>
    </article>
  );
}
