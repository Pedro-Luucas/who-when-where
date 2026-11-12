import { Icon } from "@/components/shell/nav-items";
import { Chip } from "@/components/ui/chip";
import { GATING } from "@/shared/plans";

/**
 * The gold "PRO" tier chip, on Pro games and Pro options. Shown only while the
 * plans switch (shared/plans.ts) is on preview or on; `always` shows it
 * anyway (the pricing page, which is about Pro).
 */
export function ProChip({ always, locked, className }: { always?: boolean; locked?: boolean; className?: string }) {
  if (!always && GATING === "off") return null;
  return (
    <Chip tone="pro" className={className} icon={<Icon name={locked ? "lock" : "crown"} size={13} />}>
      Pro
    </Chip>
  );
}
