"use client";

import { useEffect } from "react";

/** A friend's invite link (?ref=username): remembered for 30 days, so signing up later still counts. */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[a-z0-9_.-]{2,40}$/i.test(ref)) document.cookie = `ramai_ref=${encodeURIComponent(ref)}; max-age=${30 * 86400}; path=/; samesite=lax; secure`;
  }, []);
  return null;
}
