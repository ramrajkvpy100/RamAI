"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { disableReminders, enableReminders, promptInstall, useInstallRoute, useReminders } from "@/lib/app-install";

import { InstallSheet } from "./install-sheet";

/** An iOS-style switch. */
export function Switch({ on, busy, label, onChange }: { on: boolean; busy?: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cn("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60", on ? "bg-success" : "bg-surface-3 shadow-[inset_0_0_0_1px_var(--line)]")}
    >
      <span className={cn("absolute top-[2px] left-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-transform duration-200", on && "translate-x-[18px]")} />
    </button>
  );
}

/** Menu rows: install RamAI as an app, and the daily reminder. Each appears only where this browser supports it. */
export function AppOptions({ guest, onNavigate }: { guest: boolean; onNavigate?: () => void }) {
  const route = useInstallRoute();
  const reminder = useReminders();
  const [howTo, setHowTo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const install = async () => {
    if (route === "prompt") await promptInstall();
    else setHowTo(true);
  };
  const toggle = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (on) await enableReminders();
      else await disableReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const showReminder = !guest && (reminder === "on" || reminder === "off" || reminder === "blocked" || reminder === "install-first");
  const showInstall = route === "prompt" || route === "ios" || route === "mac-safari";

  return (
    <>
      {showInstall && (
        <button role="menuitem" type="button" onClick={() => void install()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-surface-3">
          <Icon name="device" size={15} className="text-fg-2" /> Install RamAI app
        </button>
      )}
      {showReminder && (
        <div className="rounded-lg px-3 py-2 text-[13.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5">
              <Icon name="bell" size={15} className="text-fg-2" /> Daily reminder
            </span>
            {reminder === "install-first" ? (
              <button type="button" onClick={() => setHowTo(true)} className="text-[12.5px] font-semibold text-accent-text">
                Add to Home Screen
              </button>
            ) : reminder === "blocked" ? (
              <span className="text-[12px] text-fg-3">Blocked</span>
            ) : (
              <Switch on={reminder === "on"} busy={busy} label="Daily reminder" onChange={(on) => void toggle(on)} />
            )}
          </div>
          {reminder === "blocked" && <p className="mt-1 pl-[25px] text-[11.5px] leading-4 text-fg-3">Notifications are off for RamAI in this browser&apos;s settings.</p>}
          {error && (
            <p role="alert" className="mt-1 pl-[25px] text-[11.5px] leading-4 text-danger">
              {error}
            </p>
          )}
        </div>
      )}
      <InstallSheet
        route={route}
        open={howTo}
        onClose={() => {
          setHowTo(false);
          onNavigate?.();
        }}
      />
    </>
  );
}
