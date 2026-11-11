import type { FamilyId } from "@/games/families";
import { cn } from "./cn";

export type ChipTone = "neutral" | "accent" | "success" | "danger" | "pro" | "new";

const TONES: Record<ChipTone, string> = {
  neutral: "border-line-strong bg-surface text-fg-2",
  accent: "border-accent/50 bg-accent-soft text-fg",
  success: "border-answer/45 bg-answer/10 text-fg",
  danger: "border-danger/50 bg-danger-soft text-fg",
  pro: "border-[#a86f0c] bg-linear-to-b from-[#ffe89a] to-[#e5a722] text-on-pro shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]",
  new: "border-transparent bg-linear-to-b from-[#c7b8ff] to-purple text-[#16072f]",
};

type ChipProps = {
  /** neutral, accent, success, danger, pro (gold) or new (violet). */
  tone?: ChipTone;
  /** A family chip: a dot in the family colour before the text. */
  family?: FamilyId;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * A small label: a family ("● Places"), a tier ("FREE", "UNLIMITED",
 * "2 LEFT", "PRO", "NEW") or a status ("Done", "Streak 12"). Never under 12px.
 */
export function Chip({ tone = "neutral", family, icon, className, children }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xs border px-2 font-mono text-xs leading-none font-semibold tracking-[0.06em] whitespace-nowrap uppercase",
        TONES[tone],
        className,
      )}
      style={family ? ({ "--fam": `var(--color-family-${family})` } as React.CSSProperties) : undefined}
    >
      {family && <i aria-hidden="true" className="size-2 rounded-[2px] bg-(--fam) shadow-[0_0_8px_var(--fam)]" />}
      {icon}
      {children}
    </span>
  );
}
