"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { ApiError } from "@/account/api";

// Data that lives on the server and changes under the page: loaded when a
// component appears, and again every so often while the tab is in view.

type Remote<T> = {
  /** undefined until the first answer arrives (and again when `key` changes). */
  data: T | undefined;
  /** Why the latest call failed, if it did. */
  error: ApiError | null;
  /** Loads again now. */
  reload: () => void;
};

/**
 * Calls `load` now and then every `every` ms (0: only once). `key` names what
 * is being loaded: when it changes the old answer is dropped; null loads nothing.
 */
export function useRemote<T>(key: string | null, load: () => Promise<T>, every = 0): Remote<T> {
  const [state, setState] = useState<{ key: string; data?: T; error: ApiError | null } | null>(null);
  const [turn, setTurn] = useState(0);
  const call = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;
    let stale = false;
    let busy = false;

    async function run() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const data = await call();
        if (!stale) setState({ key: key as string, data, error: null });
      } catch (error) {
        const failure = error instanceof ApiError ? error : new ApiError("network", 0);
        // A failed refresh keeps showing what was there.
        if (!stale) setState((previous) => ({ key: key as string, data: previous?.key === key ? previous.data : undefined, error: failure }));
      } finally {
        busy = false;
      }
    }

    void run();
    const timer = every > 0 ? setInterval(run, every) : undefined;
    document.addEventListener("visibilitychange", run);
    return () => {
      stale = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [key, every, turn]);

  const reload = useCallback(() => setTurn((value) => value + 1), []);
  const current = state?.key === key ? state : null;
  return { data: current?.data, error: current?.error ?? null, reload };
}
