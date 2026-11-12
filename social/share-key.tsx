"use client";

import { useState } from "react";
import { Icon } from "@/components/shell/nav-items";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { shareText } from "@/lib/share";
import { useConnectT } from "./connect-messages";

type Props = {
  /** Builds what is shared (text with a link), when the key is pressed. */
  text: () => string | Promise<string>;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  wide?: boolean;
};

/**
 * Shares a link: the share sheet on phones, the clipboard elsewhere, and
 * says which happened either way.
 */
export function ShareKey({ text, label, variant = "secondary", size = "md", wide }: Props) {
  const { t } = useConnectT();
  const [done, setDone] = useState<"shared" | "copied" | null>(null);

  async function share() {
    const outcome = await shareText(await text());
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
