import { cn } from "./cn";

export type StatTone = "neutral" | "accent" | "success" | "danger" | "streak";

const RULE: Record<StatTone, string> = {
  neutral: "border-t-line-strong",
  accent: "border-t-accent",
  success: "border-t-answer",
  danger: "border-t-danger",
  streak: "border-t-streak",
};

type StatTileProps = {
  /** Mono uppercase caption ("Correct", "Best combo"). */
  label: React.ReactNode;
  value: React.ReactNode;
  /** After the value, smaller ("/ 1,000", "pts"). */
  unit?: React.ReactNode;
  icon?: React.ReactNode;
  /** The colour of the rule along the top. */
  tone?: StatTone;
  className?: string;
};

/** One number with its caption, as in a result screen's stat grid. Use inside a <dl>. */
export function StatTile({ label, value, unit, icon, tone = "neutral", className }: StatTileProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 border-t-2 pt-2.5", RULE[tone], className)}>
      <dt className="flex items-center gap-1.5 font-mono text-xs tracking-[0.08em] text-fg-2 uppercase">
        {icon}
        {label}
      </dt>
      <dd className="font-mono text-2xl leading-none font-semibold text-fg tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-fg-2">{unit}</span>}
      </dd>
    </div>
  );
}
