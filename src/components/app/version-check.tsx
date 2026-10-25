"use client";

import { useEffect } from "react";

/** The version this page was built from — when the site moves on, an open tab reloads instead of running old code. */
const BUILT = process.env.NEXT_PUBLIC_RAMAI_BUILD ?? "dev";

export function VersionCheck() {
  useEffect(() => {
    if (BUILT === "dev") return;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < 60_000) return;
      last = Date.now();
      const v = await fetch("/api/version", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ v?: string }>) : null))
        .then((j) => j?.v)
        .catch(() => undefined);
      // Never mid-case or mid-drill (a reload there feels like a crash); only on coming back to the app.
      if (v && v !== "dev" && v !== BUILT && !/^\/(case|practice|exams|radiology)/.test(location.pathname)) window.location.reload();
    };
    const onShow = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
  return null;
}
