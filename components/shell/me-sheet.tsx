"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LocaleToggle } from "@/components/locale-toggle";
import { SettingsDialog } from "@/components/settings-button";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useSiteT } from "@/lib/i18n";
import { useShellT } from "@/lib/shell-messages";
import { openPanel, usePanel } from "@/lib/ui";
import { useAccountItems } from "./account-items";
import { Icon } from "./nav-items";

/**
 * The phone's "Me" sheet: who is playing, and every place of their own —
 * profile, inbox, account, logbook, expedition, the boards, the plans — plus
 * the language and the settings. It stands in for the header's account
 * popover on phones: the bottom bar's "Me" tab and the header's avatar both
 * open it (lib/ui.ts, panel "me"). Mounted once, by the bottom bar.
 */
export function MeSheet() {
  const t = useShellT();
  const site = useSiteT();
  const open = usePanel() === "me";
  const { account, guest, name, note, items } = useAccountItems();
  const [settings, setSettings] = useState(false);
  const path = usePathname();
  const close = () => openPanel(null);

  // Going somewhere puts the sheet away.
  const [shownOn, setShownOn] = useState(path);
  if (shownOn !== path) {
    setShownOn(path);
    if (open) close();
  }

  return (
    <>
      <Dialog open={open} onClose={close} title={name} description={note} closeLabel={t("close")} className="me-sheet">
        <div className="me-sheet-who" aria-hidden="true">
          {account ? (
            <Avatar name={name} color={account.avatar} size="large" />
          ) : (
            <span className="account-guest">
              <Icon name="user" size={22} />
            </span>
          )}
        </div>
        {guest && (
          <div className="me-sheet-cta">
            <ButtonLink href="/account?mode=signup" wide onClick={close}>
              {t("createAccount")}
            </ButtonLink>
            <ButtonLink href="/account" variant="secondary" wide onClick={close}>
              {t("signIn")}
            </ButtonLink>
          </div>
        )}
        <ul className="sheet-list sheet-grid">
          {items
            .filter((item) => !(guest && item.href === "/account"))
            .map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={close} aria-current={path === item.href ? "page" : undefined}>
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                  {item.badge ? <i className="badge">{item.badge > 9 ? "9+" : item.badge}</i> : null}
                </Link>
              </li>
            ))}
        </ul>
        <div className="me-sheet-foot">
          <div className="me-sheet-language">
            <span>{site("language")}</span>
            <LocaleToggle />
          </div>
          <button
            type="button"
            className="key key-secondary"
            onClick={() => {
              close();
              setSettings(true);
            }}
          >
            <Icon name="sliders" size={18} />
            {t("settings")}
          </button>
        </div>
      </Dialog>
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
    </>
  );
}
