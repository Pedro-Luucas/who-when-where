"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { translator, useLocale, type Locale } from "@/lib/i18n";
import { readStore, writeStore } from "@/lib/storage";
import { InstallRegister } from "./register";

const DISMISS_KEY = "install-dismissed";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

const COACH_ROUTES = new Set(["/", "/play", "/daily", "/community", "/account"]);

type InstallCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  steps: string;
  install: string;
  later: string;
};

const COPY: Record<Locale, InstallCopy> = {
  en: {
    eyebrow: "Home screen",
    title: "A better way to play",
    lead: "Installing on the home screen is the better way to play: full screen, and easier to come back.",
    steps: "Share, then Add to Home Screen.",
    install: "Install",
    later: "Not now",
  },
  pt: {
    eyebrow: "Tela de início",
    title: "Um jeito melhor de jogar",
    lead: "Instalar na tela de início é o melhor jeito de jogar: tela cheia e mais fácil de voltar.",
    steps: "Compartilhar, depois Adicionar à Tela de Início.",
    install: "Instalar",
    later: "Agora não",
  },
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type CoachKind = "hidden" | "chromium" | "ios";

let deferredPrompt: InstallPromptEvent | null = null;
let sessionInstalled = false;
let promptHooked = false;
const promptSubscribers = new Set<() => void>();

function publishPrompt() {
  promptSubscribers.forEach((notify) => notify());
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  if (!("prompt" in event)) return false;
  const candidate = event as { prompt?: unknown };
  return typeof candidate.prompt === "function";
}

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * iPhone and iPad Safari only. Android never matches. Other iOS browsers are
 * excluded by name. In-app webviews are excluded when their token is one we
 * know; the rest fail the Version/ + Safari/ check that real Safari sends.
 */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return false;
  const iphone = /iPhone|iPod/.test(ua);
  const ipad =
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && window.matchMedia("(pointer: coarse)").matches);
  if (!iphone && !ipad) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\//.test(ua)) return false;
  if (
    /Instagram|FBAN|FBAV|FB_IAB|MicroMessenger|Line\/|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|LinkedInApp|Discord|Slack/i.test(
      ua,
    )
  ) {
    return false;
  }
  return /Version\/[\d.]+/.test(ua) && /Safari\//.test(ua);
}

function showsCoach(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return COACH_ROUTES.has(path);
}

function dismissedRecently(): boolean {
  const at = readStore(DISMISS_KEY, 0, (value) => typeof value === "number" && Number.isFinite(value));
  return at > 0 && Date.now() - at < DISMISS_FOR_MS;
}

function coachKind(): CoachKind {
  if (isStandalone() || sessionInstalled || dismissedRecently()) return "hidden";
  if (deferredPrompt) return "chromium";
  if (isIosSafari()) return "ios";
  return "hidden";
}

function onBeforeInstall(event: Event) {
  if (!isInstallPrompt(event) || isStandalone() || sessionInstalled || dismissedRecently()) return;
  event.preventDefault();
  deferredPrompt = event;
  publishPrompt();
}

function onAppInstalled() {
  deferredPrompt = null;
  sessionInstalled = true;
  publishPrompt();
}

function hookInstallPrompt() {
  if (promptHooked || typeof window === "undefined") return;
  promptHooked = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onAppInstalled);
}

hookInstallPrompt();

function hiddenOnServer(): CoachKind {
  return "hidden";
}

function subscribeCoach(listener: () => void) {
  promptSubscribers.add(listener);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  return () => {
    promptSubscribers.delete(listener);
    media.removeEventListener("change", listener);
  };
}

function snooze() {
  writeStore(DISMISS_KEY, Date.now());
  deferredPrompt = null;
  publishPrompt();
}

/** Home-screen install guidance, plus the shared service-worker registration. */
export function InstallCoach() {
  return (
    <>
      <InstallRegister />
      <CoachSheet />
    </>
  );
}

function CoachSheet() {
  const t = translator(COPY, useLocale());
  const pathname = usePathname();
  const titleId = useId();
  const kind = useSyncExternalStore(subscribeCoach, coachKind, hiddenOnServer);
  const [busy, setBusy] = useState(false);

  async function install() {
    const current = deferredPrompt;
    if (!current || busy) return;
    setBusy(true);
    try {
      await current.prompt();
      const choice = await current.userChoice;
      if (choice.outcome === "accepted") sessionInstalled = true;
    } catch {
      // The event can only be used once.
    } finally {
      deferredPrompt = null;
      setBusy(false);
      publishPrompt();
    }
  }

  if (!showsCoach(pathname) || kind === "hidden") return null;

  return (
    <section className="install-coach" aria-labelledby={titleId}>
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 id={titleId}>{t("title")}</h2>
      <p className="hint">{t("lead")}</p>
      {kind === "ios" ? <p className="install-coach-steps">{t("steps")}</p> : null}
      <div className="install-coach-actions">
        {kind === "chromium" ? (
          <Button onClick={() => void install()} loading={busy}>
            {t("install")}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={snooze} disabled={busy}>
          {t("later")}
        </Button>
      </div>
    </section>
  );
}
