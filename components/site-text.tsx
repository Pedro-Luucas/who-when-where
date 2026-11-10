"use client";

import { SITE_MESSAGES, useSiteT } from "@/lib/i18n";

/** A site string in the player's language, usable from Server Components. */
export function SiteText({ k }: { k: keyof (typeof SITE_MESSAGES)["en"] }) {
  return useSiteT()(k);
}
