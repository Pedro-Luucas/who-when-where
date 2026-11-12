"use client";

import Link from "next/link";
import { GameArt } from "@/components/game-art";
import { Icon } from "@/components/shell/nav-items";
import { ProgressRing } from "@/components/ui/progress-ring";
import { FAMILIES } from "@/games/families";
import { CHALLENGE_GAMES } from "@/games/registry";
import { useToday } from "@/games/today";
import { useSecondsUntilTomorrow } from "@/lib/clock";
import { useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { TodayChip } from "./game-tile";

/** "6 h 12 min", "12 min": the time left until the next puzzles. */
export function useCountdown(): string {
  const seconds = useSecondsUntilTomorrow();
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return hours ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
}

/** "New puzzles in 6 h 12 min", ticking. */
export function Countdown() {
  const t = useShellT();
  const left = useCountdown();
  return <span className="countdown-line">{t("newIn", { time: left })}</span>;
}

/** Today's progress as a ring: "2/6 done today". */
export function DoneRing({ size = 64 }: { size?: number }) {
  const t = useShellT();
  const { done } = useToday();
  const total = CHALLENGE_GAMES.length;
  return (
    <span className="done-ring">
      <ProgressRing
        value={done / total}
        size={size}
        stroke={Math.max(4, Math.round(size / 12))}
        color="var(--play)"
        label={`${t("doneOf", { n: done, total })} ${t("doneTodayLabel")}`}
      >
        {t("doneOf", { n: done, total })}
      </ProgressRing>
      <small>{t("doneTodayLabel")}</small>
    </span>
  );
}

/** The daily challenge's puzzles as cards: its scene, family and number, how it stands, and the way in. */
export function DailyCards({ variant = "strip" }: { variant?: "strip" | "grid" }) {
  const t = useShellT();
  const locale = useLocale();
  const { day, of } = useToday();
  return (
    <ul className="daily-cards" data-variant={variant}>
      {CHALLENGE_GAMES.map((game) => {
        const today = of(game.slug);
        return (
          <li
            key={game.slug}
            className="daily-card"
            data-family={game.family}
            data-state={today.state}
            style={{ "--fam": `var(--color-family-${game.family})` } as React.CSSProperties}
          >
            <Link href={`/play/${game.slug}`} className="daily-card-hit">
              <GameArt slug={game.slug} family={game.family} caption={game.theme[locale]} className="daily-card-art" />
              <span className="tile-meta">
                <b>{FAMILIES[game.family].name[locale]}</b> {day ? `#${day}` : ""}
              </span>
              <span className="tile-title">{game.title}</span>
              {variant === "grid" && <span className="tile-blurb">{game.blurb[locale]}</span>}
              <span className="tile-foot">
                <TodayChip today={today} />
                <span className="daily-card-go">
                  {/* A finished day already shows its score: the arrow is enough. */}
                  <span className={today.state === "done" ? "sr-only" : undefined}>
                    {t(today.state === "done" ? "seeResult" : today.state === "started" ? "continue" : "play")}
                  </span>
                  <Icon name="chevron" size={15} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The dailies strip at the top of the home and catalogue pages. */
export function DailiesStrip({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const t = useShellT();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="dailies" aria-labelledby="dailies-heading">
      <header className="section-head">
        <div className="section-title">
          <Heading id="dailies-heading">{t("dailyGames")}</Heading>
          <DoneRing size={46} />
        </div>
        <Countdown />
        <Link href="/daily" className="key key-secondary key-sm section-link">
          {t("allDailies")}
          <Icon name="chevron" size={15} />
        </Link>
      </header>
      <DailyCards />
    </section>
  );
}
