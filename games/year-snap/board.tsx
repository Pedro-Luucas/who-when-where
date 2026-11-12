"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageCredit } from "@/components/image-credit";
import { Hud, type Pip } from "@/components/play/hud";
import { Plaque } from "@/components/play/plaque";
import { ResultCard, type ReviewRow } from "@/components/play/result-card";
import { Lightbox, type LightboxImage, type LightboxLabels } from "@/components/ui/lightbox";
import { YearDial } from "@/components/year-dial";
import { formatNumber, translator, useLocale } from "@/lib/i18n";
import { MAX_POINTS } from "@/lib/points";
import { useShellT } from "@/lib/shell-messages";
import { SQUARE, headlineKey, shareLines } from "../engines/kit";
import { useBoardKeys, useReveal } from "../engines/reveal";
import { PASS } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, { MIN_YEAR, ROUNDS, START_YEAR, scoreOf, walkOf, type Judged, type Move, type Photo, type Puzzle } from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** The photo being dated fills the stage: about 720px wide on a desktop, the whole width on a phone. */
const PHOTO_SIZES = "(min-width: 1024px) 720px, 100vw";

const TONE = { hit: "on", near: "near", miss: "off", skip: "off" } as const;

/** "Exact year!", "1 year off", "12 years off" — or "Gave up". */
function offText(judged: Judged, t: T, gaveUp: string): string {
  if (judged.off === null) return gaveUp;
  return judged.off === 0 ? t("exact") : judged.off === 1 ? t("oneOff") : t("yearsOff", { n: judged.off });
}

const pointsOf = (judged: Judged) => Math.round((MAX_POINTS * judged.share) / ROUNDS);

function creditLabels(t: T) {
  return {
    kind: t("creditPhoto"),
    publicDomain: t("creditPublicDomain"),
    unknownAuthor: t("creditUnknown"),
    source: t("creditSource"),
  };
}

function lightboxLabels(t: T, title: string): LightboxLabels {
  return {
    title,
    close: t("close"),
    previous: t("previous"),
    next: t("next"),
    position: (n, total) => t("position", { n, total }),
    credit: creditLabels(t),
  };
}

function Board({ puzzle, moves, onMove, onMoves, year, label, children }: BoardProps<Puzzle, Move>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  const walk = walkOf(puzzle, moves);
  const reveal = useReveal(walk.done);
  const score = scoreOf(puzzle, moves);
  // The photo whose year is on screen, or the one being dated.
  const showing = reveal.showing ? walk.done - 1 : null;
  const index = Math.min(showing ?? walk.done, puzzle.length - 1);
  const photo = puzzle[index];
  const judged = showing !== null ? walk.rounds[showing] : null;
  const finished = walk.over && showing === null;
  /** The photo open in the lightbox, if any. */
  const [viewing, setViewing] = useState<number | null>(null);

  function giveUp() {
    const left = puzzle.length - walk.done;
    if (left <= 0) return;
    reveal.skip(left);
    onMoves(Array.from({ length: left }, () => PASS as Move));
  }

  useBoardKeys((key) => {
    if (viewing !== null) return false;
    if (showing !== null && (key === "Enter" || key === "ArrowRight" || key === " ")) {
      reveal.next();
      return true;
    }
    return false;
  }, showing !== null);

  const pips: Pip[] = puzzle.map((_, i) => {
    const entry = walk.rounds[i];
    if (entry) return entry.verdict;
    return i === walk.done && !walk.over ? "current" : "todo";
  });
  const hud = (
    <Hud
      step={{ n: finished ? puzzle.length : index + 1, total: puzzle.length, kind: "round" }}
      pips={pips}
      stats={[{ icon: "target", label: shell("score"), value: formatNumber(score.points, locale) }]}
      onGiveUp={giveUp}
      over={walk.over}
    />
  );

  if (finished) {
    const answered = walk.rounds.filter((entry) => entry.off !== null);
    const exact = answered.filter((entry) => entry.off === 0).length;
    const averageOff = answered.length
      ? Math.round(answered.reduce((sum, entry) => sum + (entry.off ?? 0), 0) / answered.length)
      : null;
    const review: ReviewRow[] = puzzle.map((entry, i) => {
      const done = walk.rounds[i];
      return {
        id: entry.id,
        label: entry.caption[locale],
        verdict: done.verdict,
        yours: done.year ?? shell("gaveUp"),
        right: entry.year,
        value: done.off === null ? undefined : t("points", { n: pointsOf(done) }),
      };
    });
    const years = puzzle.map((entry) => entry.year);
    const slides: LightboxImage[] = puzzle.map((entry) => ({
      src: entry.image.src,
      width: entry.image.width,
      height: entry.image.height,
      alt: entry.caption[locale],
      caption: `${entry.year} · ${entry.caption[locale]}`,
      credit: entry.image.credit,
    }));

    return (
      <main className="game" data-game={definition.slug} data-summary="">
        {hud}
        <aside className="dossier dossier-plain">
          <div className="dossier-text">
            <p className="eyebrow">{label}</p>
            <p className="dossier-description">{t("lead")}</p>
          </div>
        </aside>
        <section className="stage">
          <div className="summary">
            <ResultCard
              label={label}
              headline={shell(headlineKey(score.points))}
              answer={t("answer", { from: Math.min(...years), to: Math.max(...years) })}
              points={score.points}
              stats={[
                { label: t("statExact"), value: `${exact}/${puzzle.length}`, tone: exact === puzzle.length ? "hit" : undefined },
                { label: t("statOff"), value: averageOff === null ? "—" : t("yearsShort", { n: averageOff }) },
              ]}
              review={review}
            >
              {children}
            </ResultCard>

            <figure className="snap-strip">
              <figcaption>
                <span className="eyebrow">{t("stripTitle")}</span>
              </figcaption>
              <ol>
                {puzzle.map((entry, i) => {
                  const done = walk.rounds[i];
                  return (
                    <li key={entry.id} data-verdict={done.verdict}>
                      <button
                        type="button"
                        className="snap-thumb"
                        onClick={() => setViewing(i)}
                        aria-label={t("openPhoto", { n: i + 1, total: puzzle.length })}
                        aria-haspopup="dialog"
                      >
                        <Image
                          src={entry.image.src}
                          alt={entry.caption[locale]}
                          width={entry.image.width}
                          height={entry.image.height}
                          sizes="(min-width: 768px) 220px, 45vw"
                        />
                      </button>
                      <div className="snap-strip-text">
                        <p className="snap-strip-year">
                          <strong>{entry.year}</strong>
                          <small>
                            {t("yourYear")}: {done.year ?? "—"}
                          </small>
                        </p>
                        <p className="snap-strip-caption">{entry.caption[locale]}</p>
                        <ImageCredit credit={entry.image.credit} labels={creditLabels(t)} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </figure>
          </div>
        </section>
        <Lightbox
          images={slides}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          labels={lightboxLabels(t, t("dialogAll"))}
        />
      </main>
    );
  }

  // While the year is still to be set the photo is the only clue: no caption, no credit.
  const slide: LightboxImage = judged
    ? {
        src: photo.image.src,
        width: photo.image.width,
        height: photo.image.height,
        alt: photo.caption[locale],
        caption: `${photo.year} · ${photo.caption[locale]}`,
        credit: photo.image.credit,
      }
    : { src: photo.image.src, width: photo.image.width, height: photo.image.height, alt: t("mystery") };

  return (
    <main className="game" data-game={definition.slug}>
      {hud}
      <aside className="dossier dossier-plain">
        <div className="dossier-text">
          <p className="eyebrow">{label}</p>
          <p className="dossier-lead">{t("lead")}</p>
        </div>
      </aside>

      <section className="stage" key={photo.id}>
        <Plaque
          eyebrow={shell("plaqueYear")}
          text={t("prompt")}
          tone={judged ? TONE[judged.verdict] : undefined}
          status={
            judged ? (
              <>
                <b>{offText(judged, t, shell("gaveUp"))}</b> · {t("taken", { year: photo.year })}
              </>
            ) : undefined
          }
        />

        <figure className="snap-photo" data-revealed={judged ? "" : undefined}>
          <button
            type="button"
            className="snap-photo-button"
            onClick={() => setViewing(0)}
            aria-label={t("enlarge")}
            aria-haspopup="dialog"
          >
            <Image
              src={photo.image.src}
              alt={slide.alt}
              width={photo.image.width}
              height={photo.image.height}
              sizes={PHOTO_SIZES}
              loading="eager"
            />
            <span className="snap-zoom" aria-hidden="true">
              <ZoomIcon />
            </span>
          </button>
          {/* The next photo loads out of sight while this one's year is on screen. */}
          {judged && puzzle[index + 1] && (
            <span className="snap-preload" aria-hidden="true">
              <Image
                src={puzzle[index + 1].image.src}
                alt=""
                width={puzzle[index + 1].image.width}
                height={puzzle[index + 1].image.height}
                sizes={PHOTO_SIZES}
                loading="eager"
              />
            </span>
          )}
          {judged && (
            <figcaption>
              <p className="snap-caption">{photo.caption[locale]}</p>
              <ImageCredit credit={photo.image.credit} labels={creditLabels(t)} />
            </figcaption>
          )}
        </figure>

        {judged ? (
          <Revealed photo={photo} judged={judged} t={t} gaveUp={shell("gaveUp")} />
        ) : (
          <Guess key={photo.id} max={year} t={t} lockLabel={shell("lockIn")} onLock={(guess) => onMove(guess)} />
        )}

        {judged && (
          <div className="controls action-bar" role="status">
            <p className="hint">
              {judged.off === null ? shell("gaveUp") : t("points", { n: pointsOf(judged) })}
            </p>
            <button type="button" className="button" onClick={reveal.next} autoFocus>
              {walk.over ? shell("seeResult") : t("nextPhoto")}
            </button>
          </div>
        )}
      </section>

      <Lightbox
        images={[slide]}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
        labels={lightboxLabels(t, t("dialogOne"))}
      />
    </main>
  );
}

/** The dial and its key. "Lock in" waits until the dial has been used, so a stray tap never sends the starting year. */
function Guess({ max, t, lockLabel, onLock }: { max: number; t: T; lockLabel: string; onLock: (year: number) => void }) {
  const start = Math.min(START_YEAR, max);
  const [year, setYear] = useState(start);
  const [touched, setTouched] = useState(false);

  return (
    <>
      <div
        className="dial-panel"
        onKeyDown={(event) => {
          // Enter on the ruler locks the year in (in the year field it only confirms the typing).
          if (event.key !== "Enter" || !touched || (event.target as HTMLElement).getAttribute("role") !== "slider") return;
          event.preventDefault();
          onLock(year);
        }}
      >
        <YearDial
          initial={start}
          min={MIN_YEAR}
          max={max}
          onChange={setYear}
          onTouch={() => setTouched(true)}
          label={t("dialLabel")}
        />
      </div>
      <div className="controls action-bar">
        <p className="hint">{t("hint")}</p>
        <button type="button" className="button" disabled={!touched} onClick={() => onLock(year)}>
          {lockLabel}
        </button>
      </div>
    </>
  );
}

/** The year set and the real one on a stretch of timeline. */
function Revealed({ photo, judged, t, gaveUp }: { photo: Photo; judged: Judged; t: T; gaveUp: string }) {
  const guess = judged.year;
  const answer = photo.year;
  const low = Math.min(guess ?? answer, answer);
  const high = Math.max(guess ?? answer, answer);
  const pad = Math.max(4, (high - low) * 0.35);
  const from = low - pad;
  const span = high + pad - from;
  const at = (value: number) => `${(((value - from) / span) * 100).toFixed(2)}%`;
  const exact = guess === answer;

  return (
    <div className="timeline snap-timeline" data-exact={exact ? "" : undefined} aria-label={offText(judged, t, gaveUp)}>
      <div className="timeline-track">
        {guess !== null && !exact && (
          <span className="timeline-gap" style={{ left: at(low), width: `${(((high - low) / span) * 100).toFixed(2)}%` }} />
        )}
        {guess !== null && !exact && (
          <span className="timeline-flag timeline-flag-guess" style={{ left: at(guess) }}>
            <small>{t("yourYear")}</small>
            <strong>{guess}</strong>
          </span>
        )}
        <span className="timeline-flag timeline-flag-answer" style={{ left: at(answer) }}>
          <small>{t("realYear")}</small>
          <strong>{answer}</strong>
        </span>
      </div>
    </div>
  );
}

function ZoomIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14M7 5v4M5 7h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default defineSetBoard<Puzzle, Move, MessageKey>(definition, {
  data,
  Board,
  messages: MESSAGES,
  kicker: "kicker",
  help: ["help1", "help2", "help3", "help4"],
  share({ day, puzzle, moves, url }) {
    const walk = walkOf(puzzle, moves);
    const squares = walk.rounds.map((round) => SQUARE[round.verdict]).join("");
    return shareLines(definition.title, day, scoreOf(puzzle, moves).points, squares, url);
  },
});
