import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

type Labelled = {
  /** What it does, in words: the accessible name and the hover title. Required. */
  label: string;
  /** Also shows the label next to the icon from the md breakpoint up. */
  showLabel?: boolean;
  /** A count in a red badge on the corner (unread messages, invites…). */
  badge?: number;
};

function Inner({ label, showLabel, badge, children }: Labelled & { children: React.ReactNode }) {
  return (
    <>
      {children}
      {showLabel && <span className="hidden pr-1 font-sans text-sm font-semibold md:inline">{label}</span>}
      {!!badge && (
        <i className="badge absolute -top-1.5 -right-1.5" aria-hidden="true">
          {badge > 99 ? "99+" : badge}
        </i>
      )}
    </>
  );
}

const shape = (showLabel?: boolean) => cn("icon-button", showLabel && "md:flex md:w-auto md:gap-2 md:px-3");

/** A 44px key with an icon. Always has an accessible name. */
export function IconButton({ label, showLabel, badge, className, children, type, ...rest }: ComponentProps<"button"> & Labelled) {
  return (
    <button type={type ?? "button"} className={cn(shape(showLabel), className)} aria-label={label} title={label} {...rest}>
      <Inner label={label} showLabel={showLabel} badge={badge}>
        {children}
      </Inner>
    </button>
  );
}

/** The same key as a link. */
export function IconLink({ label, showLabel, badge, className, children, ...rest }: ComponentProps<typeof Link> & Labelled) {
  return (
    <Link className={cn(shape(showLabel), className)} aria-label={label} title={label} {...rest}>
      <Inner label={label} showLabel={showLabel} badge={badge}>
        {children}
      </Inner>
    </Link>
  );
}
