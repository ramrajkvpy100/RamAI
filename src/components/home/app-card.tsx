"use client";

import { useEffect, useState } from "react";

import { InstallSheet } from "@/components/app/install-sheet";
import { Icon } from "@/components/ui/icon";
import { enableReminders, promptInstall, reminderTime, useInstallRoute, useReminders } from "@/lib/app-install";

const DISMISS_KEY = "ramai.appcard.dismissed";
const QUIET_DAYS = 14;

/**
 * After the first case: put RamAI on the home screen, then turn on the daily
 * reminder. "Not now" keeps it away for two weeks.
 */
export function AppCard({ guest }: { guest: boolean }) {
  const route = useInstallRoute();
  const reminder = useReminders();
  const [quiet, setQuiet] = useState(true);
  const [howTo, setHowTo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setQuiet(Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < QUIET_DAYS * 86_400_000);
    } catch {
      setQuiet(false);
    }
  }, []);
  const dismiss = () => {
    setQuiet(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const install = route === "prompt" || route === "ios" || route === "mac-safari";
  const remind = !guest && reminder === "off";
  if (quiet || (!install && !remind)) return null;

  const act = async () => {
    setError(null);
    if (install) {
      if (route === "prompt") await promptInstall();
      else setHowTo(true);
      return;
    }
    setBusy(true);
    try {
      await enableReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn it on. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel flex animate-rise items-center gap-4 p-4 sm:p-5" aria-labelledby="app-card-heading">
      <span className="bg-ai flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-white shadow-glow">
        <Icon name={install ? "device" : "bell"} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="app-card-heading" className="text-[15px] font-semibold">
          {install ? "Get the RamAI app" : "Never lose your streak"}
        </h2>
        <p className="mt-0.5 text-[13px] leading-5 text-fg-2">
          {install
            ? "One tap from your home screen, full-screen, no app store needed."
            : `A nudge at about ${reminderTime()} — only on days you haven't played yet.`}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-[12px] text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        <button type="button" onClick={() => void act()} disabled={busy} className="bg-ai h-9 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap text-white disabled:opacity-60">
          {install ? (route === "prompt" ? "Install" : "Show me how") : busy ? "Turning on…" : "Remind me"}
        </button>
        <button type="button" onClick={dismiss} className="h-8 rounded-full px-2 text-[12.5px] font-medium text-fg-3 hover:text-fg">
          Not now
        </button>
      </div>
      <InstallSheet route={route} open={howTo} onClose={() => setHowTo(false)} />
    </section>
  );
}
