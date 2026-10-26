"use client";

import { useState } from "react";

import { useInAndroidApp } from "@/lib/in-app";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

const WIDGETS = [
  { kind: "focus", emoji: "☕", title: "Focus timer", note: "25 or 50 minutes, counting down on your home screen" },
  { kind: "progress", emoji: "🔥", title: "Daily progress", note: "Streak, XP towards today's goal, rating" },
  { kind: "ramai", emoji: "🩺", title: "RamAI", note: "Today's case and quick links" },
] as const;

/** Inside the Android app: put any of RamAI's three widgets on the home screen in one tap. */
export function AddWidgetButton({ className }: { className?: string }) {
  const inApp = useInAndroidApp();
  const [open, setOpen] = useState(false);
  if (!inApp) return null;
  const add = async (kind: string) => {
    tap();
    let t = "";
    if (kind === "progress") {
      // A read-only key so the widget can show your streak and XP (made fresh each time; only its hash is kept).
      const r = await fetch("/api/widget/token", { method: "POST" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (!r?.token) return toast("Couldn't link the widget — try again", { tone: "info" });
      t = `&t=${encodeURIComponent(r.token)}`;
    }
    window.location.href = `intent://widget?kind=${kind}${t}#Intent;scheme=ramai;package=com.ramai.app;end`;
  };
  return (
    <section className={cn("rounded-2xl border border-line bg-surface", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-[20px]">🧩</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">Add a RamAI widget</span>
          <span className="block text-[12.5px] text-fg-2">Focus timer, daily progress or today&apos;s case — on your home screen</span>
        </span>
        <span aria-hidden className={cn("text-fg-3 transition-transform", open && "rotate-90")}>›</span>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-line p-3">
          {WIDGETS.map((w) => (
            <button key={w.kind} type="button" onClick={() => void add(w.kind)} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left hover:bg-surface-3">
              <span aria-hidden className="text-[20px]">{w.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{w.title}</span>
                <span className="block text-[12px] text-fg-2">{w.note}</span>
              </span>
              <span className="text-[13px] font-semibold text-accent-text">Add</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
