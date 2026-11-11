import type { FamilyId } from "@/games/families";
import { cn } from "./cn";

type CardProps = {
  as?: "section" | "article" | "div" | "aside" | "li";
  /** A stripe in the family colour along the top edge. */
  family?: FamilyId;
  /** Higher elevation: for cards that float over others (sheets, popovers). */
  raised?: boolean;
  /** Glows on hover: for cards that are links or buttons. */
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

/** A glass panel: translucent navy, a cyan hairline, a soft shadow. */
export function Card({ as: Tag = "section", family, raised, interactive, className, style, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        "relative min-w-0 overflow-hidden rounded-lg border border-line-strong bg-(image:--panel-fill) p-5",
        raised ? "shadow-raised" : "shadow-card",
        family && "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-(--fam) before:shadow-[0_0_12px_var(--fam)]",
        interactive &&
          "transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-raised",
        className,
      )}
      style={family ? ({ ...style, "--fam": `var(--color-family-${family})` } as React.CSSProperties) : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type CardHeaderProps = {
  /** Mono uppercase line above the title. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Heading level of the title. */
  level?: 2 | 3;
  /** Actions at the end of the row (a link, a button). */
  action?: React.ReactNode;
  className?: string;
};

export function CardHeader({ eyebrow, title, level = 2, action, className }: CardHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <header className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <Heading className="text-xl font-bold text-fg">{title}</Heading>
      </div>
      {action}
    </header>
  );
}
