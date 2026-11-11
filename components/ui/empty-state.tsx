import { cn } from "./cn";

type EmptyStateProps = {
  /** A line-drawn icon (e.g. a FamilyIcon). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** What to do about it: usually a Button or ButtonLink. */
  action?: React.ReactNode;
  className?: string;
};

/** What a list or page shows when there is nothing in it yet, and what to do next. */
export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-3 rounded-lg border border-dashed border-line-strong bg-sunken/60 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="grid size-14 place-items-center rounded-full border border-line-strong bg-accent-soft text-accent [&>svg]:size-7">
          {icon}
        </span>
      )}
      <p className="font-display text-lg font-bold text-fg">{title}</p>
      {children && <div className="max-w-[42ch] text-sm leading-relaxed text-fg-2">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
