import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

// Chunky "key" buttons: a gradient face, a darker edge underneath, a press
// that sinks the key. The look lives in app/globals.css (.key, .key-*), which
// the older `.button` class shares, so every screen's buttons match.

export type ButtonVariant = "primary" | "play" | "secondary" | "ghost" | "danger" | "pro";
export type ButtonSize = "sm" | "md" | "lg";

type Look = {
  /** primary (blue), play (green: Play, Start, Next), secondary, ghost, danger, pro (gold). */
  variant?: ButtonVariant;
  /** sm 36px, md 44px, lg 52px tall. */
  size?: ButtonSize;
  /** Stretches to the width of its container. */
  wide?: boolean;
};

export function keyClass({ variant = "primary", size = "md", wide }: Look, extra?: string): string {
  return cn(
    "key",
    variant !== "primary" && `key-${variant}`,
    size !== "md" && `key-${size}`,
    wide && "w-full",
    extra,
  );
}

type ButtonProps = ComponentProps<"button"> &
  Look & {
    /** Shows a spinner and blocks the button while something is in flight. */
    loading?: boolean;
    /** An icon before the label. */
    icon?: React.ReactNode;
  };

/** A key button. Disabled while `loading`, with aria-busy for assistive technology. */
export function Button({ variant, size, wide, loading, icon, className, disabled, children, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={keyClass({ variant, size, wide }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & Look & { icon?: React.ReactNode };

/** A link that looks like a key button: for actions that go to another page. */
export function ButtonLink({ variant, size, wide, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={keyClass({ variant, size, wide }, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** A small spinning ring in the current text colour. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-current border-r-transparent motion-reduce:animate-[spin_2.4s_linear_infinite]",
        className,
      )}
    />
  );
}
