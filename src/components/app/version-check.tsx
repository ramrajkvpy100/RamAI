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
      if (v && v !== "dev" && v !== BUILT) window.location.reload();
    };
    const onShow = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onShow);
    const t = window.setInterval(check, 10 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.clearInterval(t);
    };
  }, []);
  return null;
}
