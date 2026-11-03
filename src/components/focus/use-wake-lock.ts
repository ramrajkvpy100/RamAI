"use client";

import { useEffect } from "react";

/** Keeps the screen on while the timer runs. */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const get = () => (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen").then((l) => (lock = l)).catch(() => undefined);
    void get();
    const back = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}
