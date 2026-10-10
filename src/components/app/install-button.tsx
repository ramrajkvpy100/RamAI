"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { promptInstall, useInstallRoute } from "@/lib/app-install";

import { InstallSheet } from "./install-sheet";

/**
 * "Get the app", wherever this browser can install RamAI: its own prompt
 * (Chrome, Edge, Android) or the steps Apple requires (Safari on iPhone, iPad, Mac).
 * Hidden once installed, and in browsers that can't install it.
 */
export function InstallButton({ className, label = "Get the app" }: { className?: string; label?: string }) {
  const route = useInstallRoute();
  const [howTo, setHowTo] = useState(false);
  if (route !== "prompt" && route !== "ios" && route !== "mac-safari") return null;
  return (
    <>
      <button
        type="button"
        onClick={() => (route === "prompt" ? void promptInstall() : setHowTo(true))}
        className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 text-[12.5px] font-semibold text-fg shadow-sm transition-colors hover:bg-surface-3", className)}
      >
        <Icon name="device" size={14} className="text-accent-text" />
        <span>{label}</span>
      </button>
      <InstallSheet route={route} open={howTo} onClose={() => setHowTo(false)} />
    </>
  );
}
