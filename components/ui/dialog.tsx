"use client";

import { useEffect, useId, useRef } from "react";
import { tap } from "@/lib/fx";
import { cn } from "./cn";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The close button's accessible name ("Close" / "Fechar"). */
  closeLabel: string;
  /** A line under the title, also the dialog's accessible description. */
  description?: React.ReactNode;
  /**
   * center: a card in the middle of the screen. sheet: a bottom sheet on
   * phones and a panel on the right from the lg breakpoint (setup panels).
   */
  variant?: "center" | "sheet";
  className?: string;
  children: React.ReactNode;
};

/**
 * A modal dialog on the native <dialog>: focus trapping, Escape and the
 * backdrop come free. Named by its title, which takes the focus when it opens
 * (so the first thing read is what the dialog is, not "close"); focus goes
 * back to what opened it when it closes.
 *
 * On phones every dialog is a bottom sheet (app/mobile.css): it rises from the
 * bottom edge, within the thumb's reach, and a drag down on its grip or
 * header puts it away.
 */
export function Dialog({ open, onClose, title, closeLabel, description, variant = "center", className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  /** What had focus when the dialog opened. */
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      heading.current?.focus({ preventScroll: true });
      tap();
    }
    if (!open && dialog.open) dialog.close();
    if (!open && opener.current) {
      const back = opener.current;
      opener.current = null;
      if (back.isConnected) back.focus({ preventScroll: true });
    }
  }, [open]);

  // Dragging the sheet down by its grip or header. The styles are set on the
  // element itself, frame by frame: no render while the finger moves.
  const drag = useRef<{ id: number; y: number; at: number; moved: number } | null>(null);
  const sheetLike = () => {
    const dialog = ref.current;
    return !!dialog && getComputedStyle(dialog).getPropertyValue("--sheet").trim() === "1";
  };
  function onGrab(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" || !sheetLike()) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    drag.current = { id: event.pointerId, y: event.clientY, at: event.timeStamp, moved: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onDrag(event: React.PointerEvent<HTMLElement>) {
    const state = drag.current;
    const dialog = ref.current;
    if (!state || state.id !== event.pointerId || !dialog) return;
    state.moved = Math.max(0, event.clientY - state.y);
    dialog.style.transition = "none";
    dialog.style.transform = `translateY(${state.moved}px)`;
  }
  function onRelease(event: React.PointerEvent<HTMLElement>) {
    const state = drag.current;
    const dialog = ref.current;
    if (!state || state.id !== event.pointerId || !dialog) return;
    drag.current = null;
    const speed = state.moved / Math.max(event.timeStamp - state.at, 1);
    const away = event.type !== "pointercancel" && (state.moved > 110 || (state.moved > 30 && speed > 0.55));
    dialog.style.transition = "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)";
    dialog.style.transform = away ? "translateY(100%)" : "";
    const settle = () => {
      dialog.style.transition = "";
      dialog.style.transform = "";
      if (away) onClose();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) settle();
    else setTimeout(settle, away ? 160 : 210);
  }
  const grab = { onPointerDown: onGrab, onPointerMove: onDrag, onPointerUp: onRelease, onPointerCancel: onRelease };

  return (
    <dialog
      ref={ref}
      className={cn("modal", className)}
      data-variant={variant}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-body">
        {/* The sheet's grip: only drawn where dialogs are sheets. */}
        <span className="modal-grip" aria-hidden="true" {...grab} />
        <header className="modal-header" {...grab}>
          <div className="min-w-0">
            <h2 id={titleId} ref={heading} tabIndex={-1} className="outline-none">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-fg-2">
                {description}
              </p>
            )}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
