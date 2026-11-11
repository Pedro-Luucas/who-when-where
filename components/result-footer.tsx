"use client";

import Link from "next/link";
import { useDailyResults } from "@/games/results";
import { GAME_SLUGS, GAME_THEMES, GAME_TITLES, type GameSlug } from "@/games/registry";
import { useDayNumber, useSecondsUntilTomorrow } from "@/lib/clock";
import { useLocale, useSiteT } from "@/lib/i18n";
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
};

/**
 * What every finished daily puzzle ends with: a share button, the countdown,
 * and the way on to the next of today's puzzles.
 */
export function ResultActions({ shareText, game, nextLabel }: ActionsProps) {
  const t = useSiteT();
  const secondsLeft = useSecondsUntilTomorrow();

  return (
    <>
      <div className="summary-actions">
        <ShareButton label={t("share")} text={() => shareText(`${window.location.origin}/play/${game}`)} />
        <p className="countdown">
          <span>{nextLabel ?? t("nextIn")}</span>
          <time>{clock(secondsLeft)}</time>
        </p>
      </div>
      <NextUp current={game} />
    </>
  );
}

/**
 * Today's other puzzles: a trail of the six, and a link to the next one not
 * yet finished (after this one, wrapping round) — or, once all are done, to
 * /daily, where the whole day can be shared.
 */
function NextUp({ current }: { current: GameSlug }) {
  const t = useSiteT();
  const locale = useLocale();
  const today = useDayNumber();
  const results = useDailyResults();

  const done = new Set(results.filter((result) => result.day === today).map((result) => result.game));
  const total = GAME_SLUGS.length;
  const at = GAME_SLUGS.indexOf(current);
  const next = [...GAME_SLUGS.slice(at + 1), ...GAME_SLUGS.slice(0, at)].find((game) => !done.has(game));
  const progress = t("dayProgress", { n: done.size, total });

  return (
    <nav className="next-up" aria-label={t("backToToday")} data-complete={next ? undefined : ""}>
      <div className="next-up-head">
        <span className="eyebrow">{progress}</span>
        <ol className="next-up-trail" aria-hidden="true">
          {GAME_SLUGS.map((game) => (
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
