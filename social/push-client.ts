"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/account/api";
import { deletePushSubscription, getPushKey, savePushSubscription, sendTestPush } from "./connect";

// Web Push on this device: the service worker (public/sw.js), the browser's
// permission, and the subscription the accounts API keeps (api/src/notify.ts).

/**
 * unsupported: this browser can't (or iOS outside an installed app);
 * unavailable: the server has push turned off (or predates it);
 * denied: the player blocked notifications for the site;
 * off / on: whether this device is subscribed.
 */
export type PushState = "loading" | "unsupported" | "unavailable" | "denied" | "off" | "on";

const SW_URL = "/sw.js";

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function readState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  try {
    await getPushKey();
  } catch {
    return "unavailable";
  }
  if (Notification.permission === "denied") return "denied";
  return (await currentSubscription()) ? "on" : "off";
}

/** Asks for permission, subscribes this device and tells the server. */
async function subscribe(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const { key } = await getPushKey();
  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await savePushSubscription(subscription.toJSON());
  return "on";
}

async function unsubscribe(): Promise<PushState> {
  const subscription = await currentSubscription();
  if (subscription) {
    await deletePushSubscription(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  }
  return "off";
}

/** This device's push state, and the switches for it. */
export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let stale = false;
    void readState().then((next) => {
      if (!stale) setState(next);
    });
    return () => {
      stale = true;
    };
  }, []);

  const run = useCallback(async (work: () => Promise<PushState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await work());
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError("push_failed", 0));
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state,
    busy,
    error,
    enable: () => run(subscribe),
    disable: () => run(unsubscribe),
    test: () => run(async () => (await sendTestPush(), "on")),
  };
}
