"use client";

import { useEffect, useSyncExternalStore } from "react";
import { upgradeListeners } from "@/account/api";
import { useEntitlements } from "@/account/entitlements";
import { refreshEntitlements } from "@/account/state";
import { Icon } from "@/components/shell/nav-items";
import { ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n";
import { isFeature, type Feature } from "@/shared/plans";
import { FEATURE_TEXT, useProT } from "./messages";
import { formatPrice, pricesFor } from "./prices";
import { ProChip } from "./pro-chip";

// The Pro sheet: what opens wherever a player meets a Pro gate (a Pro game's
// Play, a locked option, an API 402). Benefits, the price, "See plans" and
// "Maybe later" — never a dead end. One sheet for the whole site, mounted in
// the root layout; anything opens it with openProSheet(feature).

/** The feature that opened the sheet; undefined when closed, null for Pro in general. */
let opened: Feature | null | undefined;
const listeners = new Set<() => void>();

function set(next: Feature | null | undefined) {
  opened = next;
  listeners.forEach((listener) => listener());
}

/** Opens the Pro sheet, led by the feature that was asked for (if any). */
export function openProSheet(feature?: Feature): void {
  set(feature ?? null);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The four benefits the sheet lists after the one that was asked for. */
const HIGHLIGHTS: Feature[] = ["games.pro", "practice.unlimited", "archive.all", "party.host16"];

export function ProSheetHost() {
  const feature = useSyncExternalStore(
    subscribe,
    () => opened,
    () => undefined,
  );
  const t = useProT();
  const locale = useLocale();
  const { plan } = useEntitlements();

  // A 402 from the API: the server knows better than this page, so ask it again
  // what the account may do, and say what it was.
  useEffect(() => {
    const onUpgrade = (name: string | undefined) => {
      void refreshEntitlements();
      openProSheet(isFeature(name) ? name : undefined);
    };
    upgradeListeners.add(onUpgrade);
    return () => {
      upgradeListeners.delete(onUpgrade);
    };
  }, []);

  const benefits = feature ? [feature, ...HIGHLIGHTS.filter((item) => item !== feature)] : HIGHLIGHTS;
  const prices = pricesFor(locale);
  const close = () => set(undefined);

  return (
    <Dialog open={feature !== undefined} onClose={close} title={t("sheetTitle")} closeLabel={t("close")} className="pro-sheet">
      <div className="pro-sheet-body">
        <p className="pro-sheet-lead">
          <ProChip always /> {t("sheetLead")}
        </p>
        <ul className="pro-benefits">
          {benefits.map((item, i) => {
            const [title, line] = FEATURE_TEXT[item][locale];
            return (
              <li key={item} data-lead={i === 0 && feature ? "" : undefined}>
                <Icon name="check" size={18} />
                <span>
                  <b>{title}</b>
                  <small>{line}</small>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="pro-sheet-price">{t("sheetPrice", { price: formatPrice(prices.yearly / 12, prices.currency, locale) })}</p>
        <p className="hint">{t("sheetSoon")}</p>
        <div className="pro-sheet-actions">
          <ButtonLink href="/pricing" variant="pro" wide onClick={close} icon={<Icon name="crown" size={17} />}>
            {t("seePlans")}
          </ButtonLink>
          {plan === "guest" && (
            <ButtonLink href="/account?mode=signup" variant="secondary" wide onClick={close}>
              {t("createFree")}
            </ButtonLink>
          )}
          <button type="button" className="key key-ghost w-full" onClick={close}>
            {t("maybeLater")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
