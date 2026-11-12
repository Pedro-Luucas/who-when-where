import { cn } from "@/components/ui/cn";

/** The colours of the five league tiers: Bronze, Silver, Gold, Platinum, Diamond. */
export const TIER_COLORS = ["#d08a4f", "#c3d3e0", "#ffd45c", "#5fe3d0", "#8fb8ff"];

/** A league tier's shield, drawn in its colour. */
export function TierShield({ tier, size = 28, className }: { tier: number; size?: number; className?: string }) {
  const color = TIER_COLORS[Math.max(0, Math.min(4, tier))];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0 drop-shadow-[0_0_6px_var(--tier)]", className)}
      style={{ "--tier": color } as React.CSSProperties}
      aria-hidden="true"
    >
      <path d="M12 2.5l8 3v6.2c0 4.6-3.3 8.4-8 9.8-4.7-1.4-8-5.2-8-9.8V5.5z" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.6" />
      {Array.from({ length: Math.max(0, Math.min(4, tier)) + 1 }, (_, i) => (
        <path key={i} d={`M8.2 ${15.2 - i * 2.2}l3.8-2 3.8 2`} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** A tier chip: the shield and the league's name. */
export function TierBadge({ tier, label, className }: { tier: number; label: string; className?: string }) {
  const color = TIER_COLORS[Math.max(0, Math.min(4, tier))];
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-xs border px-2 font-mono text-xs font-semibold tracking-[0.06em] whitespace-nowrap text-fg uppercase",
        className,
      )}
      style={{ borderColor: `${color}88`, background: `${color}1f` }}
    >
      <TierShield tier={tier} size={18} />
      {label}
    </span>
  );
}
