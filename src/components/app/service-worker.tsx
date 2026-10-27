"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "@/lib/app-install";
import { toast } from "@/lib/toast";

/** Registers the service worker once the page has loaded: the installed app's offline page, and reminders. */
export function ServiceWorker() {
  // A page shown from the phone turned out to be an older version: offer the new one (timers and planner are kept).
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === "ramai:updated") toast("RamAI was updated", { tone: "info", ms: 10_000, action: { label: "Reload", run: () => window.location.reload() } });
    };
    navigator.serviceWorker?.addEventListener("message", on);
    return () => navigator.serviceWorker?.removeEventListener("message", on);
  }, []);
  useEffect(() => {
    const go = () => void registerServiceWorker();
    if (document.readyState === "complete") return go();
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  return null;
}
