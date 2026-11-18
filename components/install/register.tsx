"use client";

import { useEffect } from "react";

// Same URL social/push-client.ts passes to register() and getRegistration().
// Default scope for a worker at /sw.js is /, which covers that lookup.
const SW_URL = "/sw.js";

/**
 * Registers the existing push worker on every visit so home-screen install
 * and Web Push share one registration. The worker does not cache and does
 * not handle fetch.
 */
export function InstallRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register(SW_URL).catch(() => {
      // Private mode and insecure contexts can refuse the worker. Turning
      // notifications on registers this same URL again.
    });
  }, []);
  return null;
}
