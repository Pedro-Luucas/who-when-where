import { cn } from "./cn";

type SkeletonProps = {
  /** block: a card or an image; text: a line of text; circle: an avatar or a ring. */
  shape?: "block" | "text" | "circle";
  /** Size it with utilities (h-40, w-2/3, size-10…). */
  className?: string;
};

/** A shimmering placeholder in the shape of what is loading. Hidden from screen readers. */
export function Skeleton({ shape = "block", className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "skeleton-block block border",
        shape === "text" && "h-3.5 rounded-xs",
        shape === "circle" && "rounded-full",
        className,
      )}
    />
  );
}

/** A few lines of placeholder text, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} shape="text" className={i === lines - 1 ? "w-3/5" : "w-full"} />
      ))}
    </span>
  );
}
