"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useThemePref } from "@/lib/theme";

/** One tap between light and dark, in the top bar (the menu also offers "follow my phone"). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [, setPref] = useThemePref();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.getAttribute("data-theme") === "dark");
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);
  return (
    <button
      type="button"
      onClick={() => setPref(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-fg-2 transition-colors hover:text-fg ${className}`}
    >
      <Icon name={dark ? "sun" : "moon"} size={17} />
    </button>
  );
}
