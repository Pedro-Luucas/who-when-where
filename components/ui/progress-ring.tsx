import { cn } from "./cn";

type ProgressRingProps = {
  /** How far along, 0 to 1. */
  value: number;
  /** Diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  stroke?: number;
  /** The ring's colour: any CSS colour, a token by default. */
  color?: string;
  /**
   * What the ring means, read by screen readers ("3 of 6 done today").
   * Without it the ring is decoration.
   */
  label?: string;
  className?: string;
  /** Drawn in the middle (a count, an icon). */
  children?: React.ReactNode;
};

/** A ring that fills clockwise from the top: today's dailies, a level, a score. */
export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color = "var(--accent)",
  label,
  className,
  children,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, value));
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - filled)}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      {children && <span className="relative font-mono text-sm font-semibold text-fg tabular-nums">{children}</span>}
    </span>
  );
}
