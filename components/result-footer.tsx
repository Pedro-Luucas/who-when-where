"use client";

import { useSecondsUntilTomorrow } from "@/lib/clock";
import { useSiteT } from "@/lib/i18n";
import { ShareButton } from "./share-button";

const clock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

type ActionsProps = {
  /** Builds the spoiler-free text to share; `url` is this game's address. */
  shareText: (url: string) => string;
  /** The game's path, e.g. "/wayfarer". */
  path: string;
  /** Overrides "Next puzzle in". */
  nextLabel?: string;
};

/** What every finished puzzle ends with: a share button and the countdown. */
export function ResultActions({ shareText, path, nextLabel }: ActionsProps) {
  const t = useSiteT();
  const secondsLeft = useSecondsUntilTomorrow();

  return (
    <div className="summary-actions">
      <ShareButton label={t("share")} text={() => shareText(window.location.origin + path)} />
      <p className="countdown">
        <span>{nextLabel ?? t("nextIn")}</span>
        <time>{clock(secondsLeft)}</time>
      </p>
    </div>
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
