import { cn } from "./cn";

type ToastProps = {
  /** A few characters in the gold seal at the start (an achievement's mark, "✓"). */
  mark?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  className?: string;
};

/**
 * A notice card, as raised by toast() in lib/toasts.ts and stacked by
 * components/toasts.tsx (top centre on phones, clear of the thumb's buttons).
 * This is the card on its own, for previews and custom notices.
 */
export function Toast({ mark, title, body, className }: ToastProps) {
  return (
    <div role="status" className={cn("toast", className)}>
      {mark && (
        <i className="seal" aria-hidden="true">
          {mark}
        </i>
      )}
      <span>
        <b>{title}</b>
        {body && <small>{body}</small>}
      </span>
    </div>
  );
}
