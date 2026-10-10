"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "@/lib/app-install";

/** Registers the service worker once the page has loaded: the installed app's offline page, and reminders. */
export function ServiceWorker() {
  useEffect(() => {
    const go = () => void registerServiceWorker();
    if (document.readyState === "complete") return go();
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  return null;
}
