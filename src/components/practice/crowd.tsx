"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

interface Stats { pct: Record<string, number>; total: number; correct: number }

/** Below this many answers the numbers mean little, so they're shown as "be among the first". */
const ENOUGH = 5;

/**
 * How every doctor answered this question — sent once the doctor has answered (their own first answer counts).
 * `picked` is the chosen option's text, or null before answering.
 */
export function useCrowd(key: string, options: string[], picked: string | null, answer: string): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    setStats(null);
    if (picked === null) return;
    let off = false;
    fetch("/api/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, choice: picked, correct: picked === answer, options }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Stats | null) => !off && s && setStats(s))
      .catch(() => undefined);
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, picked]);
  return stats;
}

/** "[22%]" beside an option, once answered. */
export function OptionPct({ stats, option }: { stats: Stats | null; option: string }) {
  if (!stats || stats.total < ENOUGH) return null;
  return <span className="ml-1.5 text-[12.5px] font-medium text-fg-3 tabular">[{stats.pct[option] ?? 0}%]</span>;
}

const LEVEL = (c: number) => (c >= 75 ? ["Easy", "text-success border-success/40"] : c >= 50 ? ["Moderate", "text-sky-600 border-sky-400/50 dark:text-sky-300"] : c >= 25 ? ["Difficult", "text-amber-700 border-amber-400/60 dark:text-amber-300"] : ["Very difficult", "text-danger border-danger/40"]) as [string, string];

/** "60% got this correct" and how hard it was, from everyone's answers. */
export function CrowdBanner({ stats, className }: { stats: Stats | null; className?: string }) {
  if (!stats) return null;
  if (stats.total < ENOUGH) return <p className={cn("text-[12.5px] text-fg-3", className)}>You&apos;re among the first {Math.max(stats.total, 1)} to answer this — percentages appear after {ENOUGH} doctors.</p>;
  const [label, tone] = LEVEL(stats.correct);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="flex-1 rounded-xl border border-success/40 bg-success-soft px-3 py-2 text-[13.5px] font-medium text-success tabular">{stats.correct}% got this correct · {stats.total} doctors</span>
      <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] uppercase", tone)}>{label}</span>
    </div>
  );
}

/** A short stable key for a question's text. */
export function keyOf(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}
