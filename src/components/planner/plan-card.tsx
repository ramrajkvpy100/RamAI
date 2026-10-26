"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** On Home: today's most important task (or a nudge to set one) and how many to-dos are left. */
export function PlanCard() {
  const [info, setInfo] = useState<{ mit?: string; mitDone?: boolean; left: number } | null>(null);
  useEffect(() => {
    const d = new Date();
    const k = `day:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    fetch(`/api/planner?docs=${k}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const day = j?.docs?.[k] as { mit?: { text: string; done: boolean } | null; todos?: { done: boolean }[] } | null;
        setInfo({ mit: day?.mit?.text, mitDone: day?.mit?.done, left: (day?.todos ?? []).filter((t) => !t.done).length });
      })
      .catch(() => setInfo({ left: 0 }));
  }, []);
  return (
    <Link href="/plan" prefetch className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-[20px]">⭐</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{info?.mit ? (info.mitDone ? `✓ ${info.mit}` : info.mit) : "Plan your day"}</span>
        <span className="block text-[12.5px] text-fg-2">{info?.mit ? `Most important today${info.left ? ` · ${info.left} more to-do${info.left === 1 ? "" : "s"}` : ""}` : "Most important task, to-dos, habits and an evening review"}</span>
      </span>
      <span aria-hidden className="text-fg-3">→</span>
    </Link>
  );
}
