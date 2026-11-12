"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImageCredit, type ImageCreditData } from "@/components/image-credit";

export type LightboxImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** A line under the photo. */
  caption?: string;
  /** The caption's language, when it differs from the page's ("en" captions on the Portuguese site). */
  captionLang?: string;
  credit?: ImageCreditData;
};

export type LightboxLabels = {
  /** The dialog's accessible name: "Photos of Petra". */
  title: string;
  close: string;
  previous: string;
  next: string;
  /** "Photo {n} of {total}", read out as the photo changes. */
  position: (n: number, total: number) => string;
  /** For the credit line, as ImageCredit takes them. */
  credit: { kind: string; publicDomain: string; unknownAuthor: string; source: string };
};

type Props = {
  images: LightboxImage[];
  /** The photo shown; null when the lightbox is closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  labels: LightboxLabels;
};

/** How far a finger has to travel sideways for a swipe to change the photo. */
const SWIPE_PX = 48;

/**
 * Photos one at a time over the whole screen, on the native <dialog>: focus
 * stays inside while it is open and goes back to what opened it, Escape and a
 * click beside the photo close it. Arrow keys, the buttons on either side and
 * a sideways swipe move through the photos (round and round); vertical
 * scrolling and pinch-zoom are left to the browser. The photos either side
 * load in the background so the next one is ready.
 */
export function Lightbox({ images, index, onIndexChange, onClose, labels }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = index !== null && images.length > 0;
  const total = images.length;
  const current = open ? Math.min(Math.max(index, 0), total - 1) : 0;
  const image = images[current];

  // Open and close the dialog with the state; focus goes back where it came from.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      closeButton.current?.focus({ preventScroll: true });
    }
    if (!open && dialog.open) dialog.close();
    if (!open && opener.current) {
      const back = opener.current;
      opener.current = null;
      if (back.isConnected) back.focus({ preventScroll: true });
    }
  }, [open]);

  // The page behind stays put while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [open]);

  const go = (step: number) => {
    if (total > 1) onIndexChange((current + step + total) % total);
  };

  // ── Swipe ──
  const [drag, setDrag] = useState(0);
  const swipe = useRef<{ id: number; x: number; y: number; sideways: boolean | null } | null>(null);
  /** A swipe ends in a click on whatever was under the finger; that click must not close the lightbox. */
  const swiped = useRef(false);

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY, sideways: null };
  }

  function onPointerMove(event: React.PointerEvent) {
    const s = swipe.current;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    // Decide once, after a few pixels, whether this is a sideways swipe or not.
    if (s.sideways === null && Math.hypot(dx, dy) > 8) s.sideways = Math.abs(dx) > Math.abs(dy);
    if (s.sideways) setDrag(dx);
  }

  function onPointerEnd(event: React.PointerEvent) {
    const s = swipe.current;
    if (!s || s.id !== event.pointerId) return;
    swipe.current = null;
    setDrag(0);
    if (event.type === "pointercancel" || !s.sideways) return;
    const dx = event.clientX - s.x;
    swiped.current = true;
    window.setTimeout(() => (swiped.current = false), 400);
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
  }

  function onClick(event: React.MouseEvent) {
    if (swiped.current) return;
    // The dialog itself and the empty space around the photo are the backdrop.
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || target.dataset.backdrop !== undefined) onClose();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
  }

  const neighbours = total > 1 ? [...new Set([(current + 1) % total, (current - 1 + total) % total])] : [];
  const sizes = "(min-width: 768px) min(90vw, 1100px), 100vw";

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={labels.title}
      onClose={onClose}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {open && image && (
        <>
          <div className="lightbox-top">
            <p className="lightbox-count" aria-hidden="true">
              {current + 1} / {total}
            </p>
            <button
              ref={closeButton}
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label={labels.close}
              title={labels.close}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div
            className="lightbox-stage"
            data-backdrop=""
            data-dragging={drag ? "" : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <Image
              key={image.src}
              className="lightbox-photo"
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes={sizes}
              draggable={false}
              style={drag ? { transform: `translateX(${drag}px)` } : undefined}
            />
            {/* The photos either side, loading out of sight. */}
            <div className="lightbox-preload" aria-hidden="true">
              {neighbours.map((i) => (
                <Image
                  key={images[i].src}
                  src={images[i].src}
                  alt=""
                  width={images[i].width}
                  height={images[i].height}
                  sizes={sizes}
                  loading="eager"
                />
              ))}
            </div>
          </div>

          {total > 1 && (
            <>
              <button
                type="button"
                className="icon-button lightbox-prev"
                onClick={() => go(-1)}
                aria-label={labels.previous}
                title={labels.previous}
              >
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="icon-button lightbox-next"
                onClick={() => go(1)}
                aria-label={labels.next}
                title={labels.next}
              >
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          <div className="lightbox-caption" data-backdrop="" aria-live="polite" aria-atomic="true">
            <p className="sr-only">{labels.position(current + 1, total)}</p>
            {image.caption && (
              <p className="lightbox-caption-text" lang={image.captionLang}>
                {image.caption}
              </p>
            )}
            <ImageCredit credit={image.credit} labels={labels.credit} />
          </div>
        </>
      )}
    </dialog>
  );
}
