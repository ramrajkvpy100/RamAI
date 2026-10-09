"use client";

import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
const KEY = "ramai.theme";

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

/** The root layout script follows live system changes while the preference is "system". */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "system") setPref(v);
    } catch {}
  }, []);
  const set = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {}
    applyTheme(p);
  };
  return [pref, set];
}
