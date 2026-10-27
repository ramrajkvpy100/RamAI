"use client";

import { useEffect, useState } from "react";

import { useInAndroidApp } from "@/lib/in-app";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

const WIDGETS = [
  { kind: "focus", emoji: "☕", title: "Focus timer", note: "25 or 50 minutes, counting down on your home screen" },
  { kind: "plan", emoji: "⭐", title: "Planner", note: "Today's most important task, to-dos and habits" },
  { kind: "progress", emoji: "🔥", title: "Daily progress", note: "Streak, XP towards today's goal, rating" },
] as const;

/** Inside the Android app: put any of RamAI's three widgets on the home screen in one tap. */
export function AddWidgetButton({ className }: { className?: string }) {
  const inApp = useInAndroidApp();
  const [open, setOpen] = useState(false);
  // The read-only key for the progress and planner widgets, fetched as soon as the list opens — so the tap itself
  // goes straight to Android (Chrome only lets an app open from a tap, not after waiting on the network).
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!open || token) return;
    fetch("/api/widget/token", { method: "POST" }).then((x) => (x.ok ? x.json() : null)).then((r) => r?.token && setToken(r.token)).catch(() => undefined);
  }, [open, token]);
  if (!inApp) return null;
  const add = (kind: string) => {
    tap();
    const needsKey = kind === "progress" || kind === "plan";
    if (needsKey && !token) return toast("One moment — linking your account, then tap again", { tone: "info" });
    const t = needsKey ? `&t=${encodeURIComponent(token!)}` : "";
    window.location.href = `intent://widget?kind=${kind}${t}#Intent;scheme=ramai;package=com.ramai.app;end`;
  };
  return (
    <section className={cn("rounded-2xl border border-line bg-surface", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-[20px]">🧩</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">Add a RamAI widget</span>
          <span className="block text-[12.5px] text-fg-2">Focus timer, planner, daily progress or today&apos;s case — on your home screen</span>
        </span>
        <span aria-hidden className={cn("text-fg-3 transition-transform", open && "rotate-90")}>›</span>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-line p-3">
          {WIDGETS.map((w) => (
            <button key={w.kind} type="button" onClick={() => add(w.kind)} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left hover:bg-surface-3">
              <span aria-hidden className="text-[20px]">{w.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{w.title}</span>
                <span className="block text-[12px] text-fg-2">{w.note}</span>
              </span>
              <span className="text-[13px] font-semibold text-accent-text">Add</span>
            </button>
          ))}
          <p className="px-1 text-[12px] text-fg-3">Or add one yourself: touch and hold an empty spot on your home screen → Widgets → RamAI.</p>
        </div>
      )}
    </section>
  );
}
