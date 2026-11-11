"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAccount } from "@/account/state";
import { SettingsDialog } from "@/components/settings-button";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { useShellT } from "@/lib/shell-messages";
import { pulseCount, usePulse } from "@/social/pulse";
import { Icon, type IconName } from "./nav-items";

/**
 * The right end of the header: for guests, "Log in" and "Create free account"
 * (from the md breakpoint); for everyone, the avatar button that opens the
 * account menu — profile, logbook, expedition, community, settings.
 */
export function AccountMenu() {
  const t = useShellT();
  const state = useAccount();
  const account = state.status === "user" ? state.account : null;
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const waiting = pulseCount(usePulse());
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

  const name = account ? account.displayName || account.username || account.email : t("guest");
  const items: { href: string; label: string; icon: IconName; badge?: number }[] = [
    ...(account?.username
      ? [{ href: `/player?u=${encodeURIComponent(account.username)}`, label: t("profile"), icon: "user" as const }]
      : []),
    { href: "/account", label: account ? t("account") : t("signIn"), icon: account ? "sliders" : "user" },
    { href: "/logbook", label: t("logbook"), icon: "book" },
    { href: "/expedition", label: t("expedition"), icon: "compass" },
    { href: "/community", label: t("navCommunity"), icon: "people", badge: waiting },
    { href: "/leaderboard", label: t("navLeaderboard"), icon: "trophy" },
  ];

  return (
    <div className="account-menu" ref={root}>
      {state.status === "guest" && (
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
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t("accountMenu")}: ${name}`}
        onClick={() => setOpen((value) => !value)}
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

      <div id={menuId} className="account-popover" hidden={!open}>
        <div className="account-popover-head">
          {account ? <Avatar name={name} color={account.avatar} size="large" /> : <Icon name="user" size={28} />}
          <span>
            <b>{name}</b>
            <small>{account ? (account.username ? `@${account.username}` : account.email) : t("guestNote")}</small>
          </span>
        </div>
        {state.status === "guest" && (
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
