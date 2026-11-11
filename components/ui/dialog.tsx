"use client";

import { useEffect, useId, useRef } from "react";
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
    }
    if (!open && dialog.open) dialog.close();
    if (!open && opener.current) {
      const back = opener.current;
      opener.current = null;
      if (back.isConnected) back.focus({ preventScroll: true });
    }
  }, [open]);

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
        <header className="modal-header">
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
