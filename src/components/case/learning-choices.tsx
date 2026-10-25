"use client";

import { useEffect, useState } from "react";

import { Rich } from "@/components/ui/rich-lines";
import { WaitingFact } from "@/components/ui/waiting-fact";
import { fetchGuide, type GuideChoice } from "@/lib/engine-client";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

/**
 * Learning mode: at every step, four choices — the right one and three tempting others. Tap one to see why it's
 * right or why not for this patient; the right one is then carried out. No typing needed.
 */
export function LearningChoices({ token, turn, busy, onDo }: { token: string; turn: number; busy: boolean; onDo: (text: string) => void }) {
  const [guide, setGuide] = useState<{ question: string; options: GuideChoice[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (busy) return;
    let off = false;
    setLoading(true);
    setPicked([]);
    fetchGuide(token)
      .then((r) => !off && setGuide(r.guide))
      .catch(() => !off && setGuide(null))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
    // A new set of choices after every turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, busy]);

  if (loading || busy) {
    return (
      <div className="mx-3 mb-2 flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3" aria-busy="true">
        <div className="h-4 w-40 animate-pulse rounded bg-surface-3" />
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-2" />)}
        <WaitingFact className="mt-1" />
      </div>
    );
  }
  if (!guide) return null;
  const last = picked[picked.length - 1];
  const chosen = last !== undefined ? guide.options[last] : undefined;
  return (
    <section className="mx-3 mb-2 rounded-2xl border border-accent-line bg-surface p-3" aria-label="Learning mode choices">
      <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">🎓 {guide.question}</div>
      <div className="grid gap-1.5">
        {guide.options.map((o, n) => {
          const tried = picked.includes(n);
          return (
            <button
              key={o.text}
              type="button"
              disabled={tried || chosen?.correct}
              onClick={() => { tap(); setPicked((p) => [...p, n]); }}
              className={cn(
                "min-h-10 rounded-xl border px-3 py-2 text-left text-[14px] transition-colors",
                tried ? (o.correct ? "border-success bg-success-soft" : "border-danger bg-danger-soft") : "border-line bg-surface-2 hover:bg-surface-3",
                chosen?.correct && !tried && "opacity-55",
              )}
            >
              {o.text}
            </button>
          );
        })}
      </div>
      {chosen && (
        <div className={cn("animate-enter mt-2 rounded-xl px-3 py-2 text-[13.5px] leading-6", chosen.correct ? "bg-success-soft" : "bg-amber-50 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100")}>
          <b>{chosen.correct ? "Right — " : "Not the best now — "}</b>
          <Rich text={chosen.why} />
          {chosen.correct ? (
            <button type="button" autoFocus onClick={() => { tap(); onDo(chosen.text); }} className="mt-2 flex h-10 w-full items-center justify-center rounded-full bg-accent text-[14px] font-semibold text-on-accent">
              Do it →
            </button>
          ) : (
            <p className="mt-1 text-[12.5px] opacity-80">Pick another.</p>
          )}
        </div>
      )}
    </section>
  );
}
