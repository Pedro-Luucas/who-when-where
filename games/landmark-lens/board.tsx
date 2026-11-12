"use client";

import Image, { getImageProps } from "next/image";
import { useState } from "react";
import { preload } from "react-dom";
import { ImageCredit } from "@/components/image-credit";
import type { ResultStat } from "@/components/play/result-card";
import { Lightbox, type LightboxImage } from "@/components/ui/lightbox";
import { countryById } from "@/lib/countries";
import { formatNumber, translator, useLocale } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { countryAt } from "../engines/hit-test";
import { headlineKey, roundSquares, shareLines } from "../engines/kit";
import { PinBoard, type PinRound } from "../engines/pin";
import { roundsScore, toPinMove } from "../engines/rules";
import { defineSetBoard } from "../engines/set-board";
import type { BoardProps } from "../platform/types";
import data, {
  EXACT_KM,
  isPinCountryMove,
  judge,
  tallyOf,
  walkOf,
  type Move,
  type Photo,
  type Puzzle,
} from "./data";
import { definition } from "./definition";
import { MESSAGES, type MessageKey } from "./messages";

type Translate = (
  key: MessageKey,
  vars?: { [name: string]: string | number },
) => string;

const PHOTO_SIZES = "(max-width: 48rem) 100vw, 860px";

/** Fetches a photo in the background (the next round's), as the round's own <Image> will ask for it. */
function preloadPhoto(photo: Photo) {
  const { props } = getImageProps({
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: "",
    sizes: PHOTO_SIZES,
  });
  if (typeof props.src === "string")
    preload(props.src, {
      as: "image",
      imageSrcSet: props.srcSet,
      imageSizes: props.sizes,
    });
}

/** The round's photo, kept whole (never cropped); a tap opens it bigger. */
function LensPhoto({
  photo,
  alt,
  revealed,
  caption,
  onZoom,
  t,
  current,
}: {
  photo: Photo;
  alt: string;
  revealed: boolean;
  caption: React.ReactNode;
  onZoom: () => void;
  t: Translate;
  current: boolean;
}) {
  return (
    <figure className="lens-photo" data-revealed={revealed ? "" : undefined}>
      <button
        type="button"
        className="lens-photo-frame"
        onClick={onZoom}
        aria-label={t("enlarge")}
        aria-haspopup="dialog"
      >
        <Image
          className="lens-photo-backdrop"
          src={photo.src}
          alt=""
          aria-hidden="true"
          width={photo.width}
          height={photo.height}
          sizes={PHOTO_SIZES}
        />
        <Image
          className="lens-photo-image"
          src={photo.src}
          alt={alt}
          width={photo.width}
          height={photo.height}
          sizes={PHOTO_SIZES}
          loading={current ? "eager" : "lazy"}
          fetchPriority={current ? "high" : "auto"}
        />
        <span className="lens-photo-zoom" aria-hidden="true">
          <ZoomIcon />
        </span>
      </button>
      {revealed && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Board({
  puzzle,
  moves,
  onMove,
  onMoves,
  label,
  children,
}: BoardProps<Puzzle, Move>) {
  const locale = useLocale();
  const shell = useShellT();
  const t = translator(MESSAGES, locale);
  /** The round whose photo is open in the lightbox, if any. */
  const [viewing, setViewing] = useState<number | null>(null);
  const walk = walkOf(puzzle, moves);
  const total = puzzle.rounds.length;
  // The next round's photo loads while this one is played.
  const upcoming = puzzle.rounds[walk.done + 1];
  if (upcoming) preloadPhoto(upcoming.landmark.photos[upcoming.photo]);

  const countryName = (iso: string) => countryById(iso)?.name[locale] ?? "";
  const kmText = (km: number) =>
    km <= EXACT_KM
      ? t("spotOn")
      : t("km", { km: formatNumber(Math.round(km), locale) });
  const verdictText = (round: number, move: Move) => {
    const judged = judge(puzzle, round, move);
    return `${kmText(judged.km)} · ${judged.rightCountry ? t("rightCountry") : t("wrongCountry")}`;
  };
  const credits = {
    kind: t("creditPhoto"),
    publicDomain: t("creditPublicDomain"),
    unknownAuthor: t("creditUnknown"),
    source: t("creditSource"),
  };

  const answers = puzzle.rounds.map(({ landmark }) => {
    const country = countryName(landmark.country);
    return country
      ? `${landmark.name[locale]}, ${country}`
      : landmark.name[locale];
  });
  const photoOf = (i: number) =>
    puzzle.rounds[i].landmark.photos[puzzle.rounds[i].photo];
  const isDone = (i: number) => walk.rounds[i]?.done ?? false;
  // A round's name and credit only once it is over: before, they would give it away.
  const lightboxImage = (i: number): LightboxImage => {
    const photo = photoOf(i);
    const done = isDone(i);
    return {
      src: photo.src,
      width: photo.width,
      height: photo.height,
      alt: done ? t("photoOf", { name: answers[i] }) : t("photoAlt"),
      caption: done ? answers[i] : undefined,
      credit: done ? photo.credit : undefined,
    };
  };
  // While playing, only the round's own photo; once it is all over, all five.
  const images =
    viewing === null
      ? []
      : walk.over
        ? puzzle.rounds.map((_, i) => lightboxImage(i))
        : [lightboxImage(viewing)];

  const rounds: PinRound[] = puzzle.rounds.map(({ landmark }, i) => {
    const done = isDone(i);
    return {
      key: `${landmark.id}~${puzzle.rounds[i].photo}`,
      eyebrow: t("eyebrow"),
      prompt: t("prompt"),
      target: landmark,
      answer: answers[i],
      media: (
        <LensPhoto
          photo={photoOf(i)}
          alt={done ? t("photoOf", { name: answers[i] }) : t("photoAlt")}
          revealed={done}
          current={i === walk.done}
          onZoom={() => setViewing(i)}
          t={t}
          caption={
            <>
              <p className="lens-photo-name">
                <b>{landmark.name[locale]}</b>
                {countryName(landmark.country)
                  ? ` · ${countryName(landmark.country)}`
                  : null}
              </p>
              <ImageCredit credit={photoOf(i).credit} labels={credits} />
            </>
          }
        />
      ),
    };
  });

  const tally = tallyOf(puzzle, moves);
  const stats: ResultStat[] = [
    {
      label: t("statCountries"),
      value: `${tally.rightCountries}/${total}`,
      tone: tally.rightCountries === total ? "hit" : undefined,
    },
    {
      label: t("statDistance"),
      value:
        tally.averageKm === null
          ? "—"
          : t("kmValue", {
              km: formatNumber(Math.round(tally.averageKm), locale),
            }),
    },
  ];

  const after = (
    <figure className="life lens-grid">
      <figcaption>
        <span className="eyebrow">{t("photosTitle")}</span>
      </figcaption>
      <ol>
        {puzzle.rounds.map(({ landmark }, i) => {
          const photo = photoOf(i);
          const last = walk.rounds[i]?.tries.at(-1);
          return (
            <li key={`${landmark.id}~${puzzle.rounds[i].photo}`}>
              <button
                type="button"
                className="lens-grid-thumb"
                onClick={() => setViewing(i)}
                aria-label={t("photosOpen", { n: i + 1, total })}
                aria-haspopup="dialog"
              >
                <Image
                  src={photo.src}
                  alt={t("photoOf", { name: answers[i] })}
                  width={photo.width}
                  height={photo.height}
                  sizes="(max-width: 48rem) 50vw, 240px"
                />
                <span className="lens-grid-badge" aria-hidden="true">
                  {i + 1}
                </span>
              </button>
              <p className="lens-grid-name">
                <b>{landmark.name[locale]}</b>
                <span>{countryName(landmark.country)}</span>
                <span className="lens-grid-score">
                  {last ? verdictText(i, last.move) : shell("gaveUp")}
                </span>
              </p>
              <ImageCredit credit={photo.credit} labels={credits} />
            </li>
          );
        })}
      </ol>
    </figure>
  );

  return (
    <>
      <PinBoard<Move>
        game={definition.slug}
        rounds={rounds}
        moves={moves}
        onMove={onMove}
        onMoves={onMoves}
        tries={1}
        judge={(round, move) => judge(puzzle, round, move)}
        resolve={async (point) => {
          const [lat, lon] = toPinMove(point);
          return [lat, lon, (await countryAt(point)) ?? ""];
        }}
        describe={(round, move, judged) => {
          const at = isPinCountryMove(move)
            ? { lat: move[0], lon: move[1] }
            : puzzle.rounds[round].landmark;
          let text = verdictText(round, move);
          if (!judged) {
            const country =
              isPinCountryMove(move) && move[2] ? countryName(move[2]) : "";
            text = country
              ? t("yourPinIn", { country })
              : isPinCountryMove(move) && !move[2]
                ? t("yourPinSea")
                : t("yourPin");
          }
          // The pin not yet locked in can be dragged to fine-tune it.
          return { marker: { ...at, kind: "guess", draggable: !judged }, text };
        }}
        summary={(round, entry) => {
          const last = entry.tries.at(-1);
          return last ? verdictText(round, last.move) : shell("gaveUp");
        }}
        nothingHere={t("nothing")}
        label={label}
        lead={t("lead")}
        headline={(points) => shell(headlineKey(points))}
        stats={stats}
        after={after}
      >
        {children}
      </PinBoard>
      <Lightbox
        images={images}
        index={viewing === null ? null : walk.over ? viewing : 0}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
        labels={{
          title: t("dialog"),
          close: t("close"),
          previous: t("previous"),
          next: t("next"),
          position: (n, count) => t("position", { n, total: count }),
          credit: credits,
        }}
      />
    </>
  );
}

function ZoomIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10.5 10.5L14 14M7 5v4M5 7h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
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
    const squares = roundSquares(walk.rounds);
    return shareLines(
      definition.title,
      day,
      roundsScore(walk.shares, puzzle.rounds.length, walk.over).points,
      squares,
      url,
    );
  },
});
