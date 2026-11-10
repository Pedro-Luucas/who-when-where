"use client";

import { useState } from "react";
import { useSiteT } from "@/lib/i18n";
import { shareText } from "@/lib/share";

type Props = {
  /** Builds the text to share, when the button is pressed. */
  text: () => string;
  label: string;
  className?: string;
};

/** Shares a result: the share sheet on phones, the clipboard elsewhere. */
export function ShareButton({ text, label, className = "button" }: Props) {
  const t = useSiteT();
  const [copied, setCopied] = useState(false);

  async function share() {
    if ((await shareText(text())) !== "copied") return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  }

  return (
    <button type="button" className={className} onClick={share}>
      {copied ? t("copied") : label}
    </button>
  );
}
