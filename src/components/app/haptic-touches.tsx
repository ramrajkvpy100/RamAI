"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** On touch phones: a faint tick on every button or link pressed, like a native app (none on desktops). */
export function HapticTouches() {
  const path = usePathname();
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches || !("vibrate" in navigator)) return;
    const on = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("button, a, [role=button], [role=tab], [role=radio], summary");
      if (el && !(el as HTMLButtonElement).disabled) try { navigator.vibrate(4); } catch {}
    };
    document.addEventListener("pointerdown", on, { passive: true });
    return () => document.removeEventListener("pointerdown", on);
  }, []);
  // A gentle entrance for each new page.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.classList.remove("page-enter");
    void main.offsetWidth;
    main.classList.add("page-enter");
  }, [path]);
  return null;
}
