"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

interface View {
  id: string;
  mode: "invite" | "find" | "computer";
  you: { name: string; score: number | null };
  them: { name: string; score: number | null; computer?: boolean } | null;
  waiting: boolean;
}

/**
 * Two doctors, one patient: who's in the game, the invite link while waiting, and — once both
 * have finished — who scored higher. Checks back every few seconds until it's settled.
 */
export function DuelCard({ id, className }: { id: string; className?: string }) {
  const [view, setView] = useState<View | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    let timer: number | undefined;
    const load = async () => {
      const res = await fetch(`/api/duel/${id}`, { cache: "no-store" }).catch(() => null);
      const v = res?.ok ? ((await res.json()) as View) : null;
      if (!live) return;
      if (v) setView(v);
      if (!v || v.you.score === null || v.them?.score == null) timer = window.setTimeout(load, 6000);
    };
    void load();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [id]);

  if (!view) return null;
  const link = typeof window !== "undefined" ? `${window.location.origin}/duel/${id}` : `/duel/${id}`;
  const share = async () => {
    const text = "Same patient, two doctors — who scores higher? Play my RamAI case:";
    try {
      if (navigator.share) await navigator.share({ title: "RamAI duel", text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        setCopied(true);
      }
    } catch {}
  };
  const both = view.you.score !== null && view.them?.score != null;
  const outcome = both ? (view.you.score! > view.them!.score! ? "You win! 🏆" : view.you.score! < view.them!.score! ? `${view.them!.name} wins` : "It's a draw 🤝") : null;

  return (
    <section aria-label="Duel" className={cn("rounded-2xl border border-violet-300/50 bg-gradient-to-br from-violet-50 to-sky-50 p-4 dark:border-violet-400/25 dark:from-violet-500/10 dark:to-sky-500/10", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.12em] text-violet-700 uppercase dark:text-violet-300">⚔️ Duel</span>
        {outcome && <span className="text-[13px] font-semibold">{outcome}</span>}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
        <Side name="You" score={view.you.score} win={both && view.you.score! >= view.them!.score!} />
        {view.them ? <Side name={view.them.computer ? "🤖 Computer" : `Dr. ${view.them.name}`} score={view.them.score} win={both && view.them.score! >= view.you.score!} /> : <div className="flex items-center justify-center rounded-xl bg-white/70 p-2 text-[12.5px] text-fg-2 dark:bg-white/5">{view.mode === "find" ? "Finding an opponent…" : "Waiting for your friend…"}</div>}
      </div>
      {view.waiting && view.mode === "invite" && (
        <button type="button" onClick={() => void share()} className="mt-3 h-10 w-full rounded-full bg-violet-600 text-[13.5px] font-semibold text-white hover:bg-violet-700">
          {copied ? "Link copied — send it to a friend" : "Invite a friend"}
        </button>
      )}
      {!both && <p className="mt-2 text-[11.5px] text-fg-3">{view.you.score === null ? "Finish the case to see the result." : "Waiting for the other doctor to finish…"}</p>}
    </section>
  );
}

function Side({ name, score, win }: { name: string; score: number | null; win: boolean }) {
  return (
    <div className={cn("rounded-xl bg-white/80 p-2 dark:bg-white/5", win && "ring-2 ring-amber-300")}>
      <div className="truncate text-[12px] text-fg-2">{name}</div>
      <div className="text-[22px] font-bold tabular">{score ?? "—"}</div>
    </div>
  );
}
