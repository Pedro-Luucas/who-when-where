"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { familyStyle, useGameFrame } from "@/games/platform/frame";
import { cuePuzzle } from "@/lib/fx";
import { useFocusWhenLost } from "@/lib/focus";
import { formatNumber, useLocale } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { useShellT } from "@/lib/shell-messages";
import { ShareCardButton } from "./share-card";

// The end of every puzzle, in every game, in the same order: the verdict and
// the answer; the points as a ring and a count-up "x of 1,000", with a few
// numbers about the game; what to do next (share, the next puzzle); and the
// answer-by-answer review. The board shows the map and the reading after it.

export type Verdict = "hit" | "near" | "miss" | "skip";

export type ReviewRow = {
  id: string;
  /** "Try 2", "Born · where". */
  label: string;
  verdict: Verdict;
  yours: React.ReactNode;
  /** The right answer, where it differs from round to round. */
  right?: React.ReactNode;
  /** What the try earned or measured: "+180", "1,234 km", "4/6". */
  value?: React.ReactNode;
};

export type ResultStat = { label: string; value: React.ReactNode; tone?: Verdict };

type Props = {
  /** The line above the verdict: "No. 12 — Today's dig". */
  label: string;
  headline: React.ReactNode;
  /** The answer, under the verdict. */
  answer: React.ReactNode;
  points: number;
  stats: ResultStat[];
  review: ReviewRow[];
  /** What follows the score: sharing and the way onwards (daily), or the next stage (a run). */
  children?: React.ReactNode;
};

/** Counts up to `target` in about a second; at once when motion is reduced. */
function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/**
 * Runs of identical skipped rows ("Try 2" … "Try 5", all "Gave up") read as
 * one: "Try 2–5 · Gave up".
 */
function collapseSkips(rows: ReviewRow[]): ReviewRow[] {
  const out: (ReviewRow & { first?: string })[] = [];
  for (const row of rows) {
    const previous = out.at(-1);
    const last = /\d+$/.exec(row.label)?.[0];
    if (previous && row.verdict === "skip" && previous.verdict === "skip" && previous.yours === row.yours && last) {
      previous.first ??= previous.label;
      previous.label = `${previous.first}–${last}`;
    } else out.push({ ...row });
  }
  return out;
}

/** The ring's colour for a score: green for a great one, blue for a fair one, red for a poor one. */
const ringColour = (points: number) => (points >= 650 ? "var(--play)" : points >= 300 ? "var(--accent)" : "var(--danger)");

export function ResultCard({ label, headline, answer, points, stats, review, children }: Props) {
  const t = useShellT();
  const locale = useLocale();
  const frame = useGameFrame();
  const shown = useCountUp(points);
  const heading = useFocusWhenLost<HTMLHeadingElement>();
  const max = formatNumber(MAX_POINTS, locale);
  const share = Math.round((points / MAX_POINTS) * 100);
  const practice = !!frame?.practice;

  // A puzzle the player just finished (not one reopened) brings its result
  // into view: long boards (Timeline, Year Snap) ended with the page scrolled
  // far past the verdict.
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = card.current;
    if (!el || !navigator.userActivation?.isActive) return;
    const top = el.getBoundingClientRect().top;
    if (top >= 0 && top < window.innerHeight * 0.5) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, []);

  // A practice puzzle just finished gets its fanfare here (a daily one gets it
  // from the logbook's watcher, which sees the save). Only when the player's
  // own move ended it: a finished puzzle reopened stays quiet.
  useEffect(() => {
    if (!practice || !navigator.userActivation?.isActive) return;
    cuePuzzle(points, false);
  }, [practice, points]);

  return (
    <section ref={card} className="result-card" aria-labelledby="result-headline" style={familyStyle(frame?.family)}>
      <header className="result-card-head">
        <p className="eyebrow">
          {frame?.title && <b>{frame.title}</b>} {label}
        </p>
        <h2 id="result-headline" ref={heading} tabIndex={-1}>
          {headline}
        </h2>
        <p className="result-card-answer">{answer}</p>
      </header>

      <div className="result-card-grid">
        <div className="result-score">
          <div className="result-score-top">
            <ProgressRing value={shown / MAX_POINTS} size={84} stroke={9} color={ringColour(points)} />
            <p className="result-points">
              <strong aria-hidden="true">{formatNumber(shown, locale)}</strong>
              <span className="sr-only">{formatNumber(points, locale)} </span>
              <span>{t("pointsOf", { max })}</span>
            </p>
          </div>
          <span className="result-bar" aria-hidden="true">
            <i style={{ width: `${(shown / MAX_POINTS) * 100}%`, background: ringColour(points) }} />
          </span>
          <p className="result-share">{t("ofBest", { p: share, max })}</p>
          <dl className="result-stats">
            {stats.map((stat) => (
              <div key={stat.label} data-tone={stat.tone}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
          {frame?.slug && (
            <ShareCardButton slug={frame.slug} points={points} verdicts={review.map((row) => row.verdict)} label={label} />
          )}
        </div>

        {children && <div className="result-actions">{children}</div>}

        <div className="result-review">
          <h3>{t("answerByAnswer")}</h3>
          <ol>
            {collapseSkips(review).map((row) => (
              <li key={row.id} data-verdict={row.verdict}>
                <div className="review-top">
                  <span className="review-label">{row.label}</span>
                  <span className="review-verdict">{t(`verdict_${row.verdict}`)}</span>
                </div>
                <div className="review-answers">
                  <span>
                    <small>{t("yourAnswer")}</small>
                    <b>{row.yours}</b>
                  </span>
                  {row.right !== undefined && (
                    <span>
                      <small>{t("rightAnswer")}</small>
                      <b>{row.right}</b>
                    </span>
                  )}
                  {row.value !== undefined && <span className="review-value">{row.value}</span>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
