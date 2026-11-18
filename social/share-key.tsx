"use client";

import { useState } from "react";
import { Icon } from "@/components/shell/nav-items";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { copyText } from "@/lib/share";
import { useConnectT } from "./connect-messages";

type Props = {
  /** Builds what is shared (text with a link), when the key is pressed. */
  text: () => string | Promise<string>;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  wide?: boolean;
};

/** The share sheet when the browser has one, otherwise the clipboard. */
async function handOff(text: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}

/**
 * Shares a link: the device share sheet when it exists, the clipboard
 * otherwise, and says which happened either way.
 */
export function ShareKey({ text, label, variant = "secondary", size = "md", wide }: Props) {
  const { t } = useConnectT();
  const [done, setDone] = useState<"shared" | "copied" | null>(null);

  async function share() {
    const outcome = await handOff(await text());
    if (outcome !== "shared" && outcome !== "copied") return;
    setDone(outcome);
    setTimeout(() => setDone(null), 2400);
  }

  return (
    <Button variant={variant} size={size} wide={wide} icon={<Icon name={done ? "link" : "share"} />} onClick={share}>
      <span aria-live="polite">{done === "copied" ? t("linkCopied") : done === "shared" ? t("shared") : label}</span>
    </Button>
  );
}
