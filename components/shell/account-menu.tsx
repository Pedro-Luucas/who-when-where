"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SettingsDialog } from "@/components/settings-button";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { useIsMobile } from "@/lib/media";
import { useShellT } from "@/lib/shell-messages";
import { openPanel, usePanel } from "@/lib/ui";
import { useAccountItems } from "./account-items";
import { Icon } from "./nav-items";

/**
 * The right end of the header: for guests, "Log in" and "Create free account"
 * (from the md breakpoint); for everyone, the avatar button that opens the
 * account menu — profile, logbook, expedition, community, settings.
 *
 * On phones the avatar opens the "Me" sheet instead (shell/me-sheet.tsx): the
 * same list as a bottom sheet, within the thumb's reach.
 */
export function AccountMenu() {
  const t = useShellT();
  const { account, guest, name, note, waiting, items } = useAccountItems();
  const phone = useIsMobile();
  const sheetOpen = usePanel() === "me";
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const path = usePathname();

  // Leaving the page closes the menu.
  const [shownOn, setShownOn] = useState(path);
  if (shownOn !== path) {
    setShownOn(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={root}>
      {guest && (
        <span className="account-cta">
          <Link href="/account" className="key key-ghost key-sm">
            {t("signIn")}
          </Link>
          <ButtonLink href="/account?mode=signup" size="sm">
            {t("createAccount")}
          </ButtonLink>
        </span>
      )}
      <button
        ref={button}
        type="button"
        className="account-button"
        aria-expanded={phone ? sheetOpen : open}
        aria-controls={phone ? undefined : menuId}
        aria-haspopup={phone ? "dialog" : undefined}
        aria-label={`${t("accountMenu")}: ${name}`}
        onClick={() => (phone ? openPanel("me") : setOpen((value) => !value))}
      >
        {account ? (
          <Avatar name={name} color={account.avatar} />
        ) : (
          <span className="account-guest">
            <Icon name="user" size={18} />
          </span>
        )}
        {waiting > 0 && <i className="badge">{waiting > 9 ? "9+" : waiting}</i>}
      </button>

      <div id={menuId} className="account-popover" hidden={!open || phone}>
        <div className="account-popover-head">
          {account ? <Avatar name={name} color={account.avatar} size="large" /> : <Icon name="user" size={28} />}
          <span>
            <b>{name}</b>
            <small>{note}</small>
          </span>
        </div>
        {guest && (
          <ButtonLink href="/account?mode=signup" wide size="sm" className="account-popover-cta">
            {t("createAccount")}
          </ButtonLink>
        )}
        <ul>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.badge ? <i className="badge">{item.badge > 9 ? "9+" : item.badge}</i> : null}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSettings(true);
              }}
            >
              <Icon name="sliders" />
              <span>{t("settings")}</span>
            </button>
          </li>
        </ul>
      </div>
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
