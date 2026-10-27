"use client";

import { useEffect, useRef, useState } from "react";

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
  const [retry, setRetry] = useState(0);
  // Folded away to read the chat; remembered for the next steps.
  const [folded, setFolded] = useState(() => { try { return localStorage.getItem("ramai.lm.folded") === "1"; } catch { return false; } });
  const fold = (on: boolean) => { tap(); setFolded(on); try { localStorage.setItem("ramai.lm.folded", on ? "1" : "0"); } catch {} };
  const touched = useRef(false);

  useEffect(() => {
    if (busy) return;
    let off = false;
    setLoading(true);
    setPicked([]);
    touched.current = false;
    // The case file's four choices at once; the model's (better worded, with reasons) replace them when they
    // arrive — unless a choice has already been tapped.
    let shown = false;
    fetchGuide(token, true)
      .then((r) => { if (!off && r.guide && !shown) { shown = true; setGuide(r.guide); setLoading(false); } })
      .catch(() => undefined);
    fetchGuide(token)
      .then((r) => { if (!off && r.guide && !touched.current) { shown = true; setGuide(r.guide); } })
      .catch(() => undefined)
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
    // A new set of choices after every turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, busy, retry]);

  if (folded) {
    return (
      <button type="button" onClick={() => fold(false)} className="mx-3 mb-2 flex items-center justify-between rounded-full border border-accent-line bg-surface px-4 py-2 text-[13.5px] font-semibold">
        🎓 {loading || busy ? "Choices coming…" : "Show the 4 choices"} <span aria-hidden>▴</span>
      </button>
    );
  }
  if (loading || busy) {
    return (
      <div className="mx-3 mb-2 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-surface p-2.5" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-surface-2" />)}
        <WaitingFact className="col-span-2 mt-0.5" />
      </div>
    );
  }
  if (!guide) {
    return (
      <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-fg-2">
        The choices didn&apos;t load.
        <button type="button" onClick={() => setRetry((n) => n + 1)} className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-on-accent">Try again</button>
      </div>
    );
  }
  const last = picked[picked.length - 1];
  const scrollToWhy = (el: HTMLDivElement | null) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const chosen = last !== undefined ? guide.options[last] : undefined;
  return (
    // Kept small, so the chat above stays in view: at most about a third of the screen, scrolling inside itself.
    <section className="mx-3 mb-2 max-h-[34dvh] overflow-y-auto overscroll-contain rounded-2xl border border-accent-line bg-surface p-2.5" aria-label="Learning mode choices">
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold">
        <span className="min-w-0 flex-1">🎓 {guide.question}</span>
        <button type="button" onClick={() => fold(true)} aria-label="Hide the choices" className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium text-fg-3 hover:bg-surface-3">Hide ▾</button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {guide.options.map((o, n) => {
          const tried = picked.includes(n);
          return (
            <button
              key={o.text}
              type="button"
              disabled={tried || chosen?.correct}
              onClick={() => { tap(); touched.current = true; setPicked((p) => [...p, n]); }}
              className={cn(
                "min-h-11 rounded-xl border px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors",
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
        <div key={last} ref={scrollToWhy} className={cn("animate-enter mt-2 rounded-xl px-3 py-2 text-[13px] leading-5", chosen.correct ? "bg-success-soft" : "bg-amber-50 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100")}>
          <b>{chosen.correct ? "Right — " : "Not the best now — "}</b>
          <Rich text={chosen.why} />
          {chosen.correct ? (
            <button type="button" autoFocus onClick={() => { tap(); onDo(chosen.text); }} className="mt-2 flex h-9 w-full items-center justify-center rounded-full bg-accent text-[14px] font-semibold text-on-accent">
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
