"use client";

import Link from "next/link";
import { useShellT } from "@/lib/shell-messages";

/** The wordmark: the globe, then Who · When · Where (W·W·W on narrow screens). */
export function Logo() {
  const t = useShellT();
  return (
    <Link href="/" className="wordmark" aria-label={t("homeLabel")}>
      <span>
        W<em>ho</em>
      </span>
      <i aria-hidden="true">·</i>
      <span>
        W<em>hen</em>
      </span>
      <i aria-hidden="true">·</i>
      <span>
        W<em>here</em>
      </span>
    </Link>
  );
}
