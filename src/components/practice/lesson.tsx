"use client";

import { useMemo, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { Rich } from "@/components/ui/rich-lines";
import { LESSONS } from "@/lib/lessons";
import { referenceFor } from "@/lib/lesson-reference";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

/** "📖 Learn" — the basics of this drill, one simple card at a time (several lessons: pick one first). */
export function LessonButton({ ids, className }: { ids: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [which, setWhich] = useState<string | null>(ids.length === 1 ? ids[0]! : null);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<"basics" | "all">("basics");
  const lesson = which ? LESSONS[which] : null;
  const reference = useMemo(() => (which && mode === "all" ? referenceFor(which) : []), [which, mode]);
  const close = () => { setOpen(false); setI(0); setMode("basics"); if (ids.length > 1) setWhich(null); };
  return (
    <>
      <button type="button" onClick={() => { tap(); setOpen(true); }} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3.5 text-[13.5px] font-semibold text-accent-text", className)}>
        📖 Learn
      </button>
      <Sheet open={open} onClose={close} title={lesson ? lesson.title : "Learn the basics"} description={lesson ? lesson.intro : "Pick a topic — a few short cards, then you're ready."} placement="responsive">
        {!lesson ? (
          <div className="grid gap-2">
            {ids.map((id) => (
              <button key={id} type="button" onClick={() => { tap(); setWhich(id); setI(0); }} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left text-[14.5px] font-medium hover:bg-surface-2">
                {LESSONS[id]?.title}
                <span className="text-[12.5px] text-fg-3">{LESSONS[id]?.cards.length} cards</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-3 p-1 text-[13px]" role="tablist">
              {([["basics", "🧒 The basics"], ["all", "📘 Everything for this drill"]] as const).map(([m, label]) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-full py-1.5 font-semibold", mode === m ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>{label}</button>
              ))}
            </div>
            {mode === "all" ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-fg-2">Every answer this drill can ask, with the reason — read a group, then practise it.</p>
                {reference.map((g) => (
                  <details key={g.group} className="rounded-2xl border border-line bg-surface" open={reference.length === 1}>
                    <summary className="cursor-pointer list-none px-4 py-3 text-[14.5px] font-semibold">{g.group} <span className="font-normal text-fg-3">· {g.items.length}</span></summary>
                    <ul className="flex flex-col gap-2.5 border-t border-line px-4 py-3">
                      {g.items.map((it) => (
                        <li key={it.title} className="text-[14px] leading-6">
                          <div className="font-semibold"><Rich text={it.title} /></div>
                          <div className="text-fg-2"><Rich text={it.text} /></div>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
                {!reference.length && <p className="text-[13px] text-fg-3">Nothing to list here yet.</p>}
              </div>
            ) : (<>
            <div className="flex gap-1" aria-hidden>
              {lesson.cards.map((_, k) => <span key={k} className={cn("h-1.5 flex-1 rounded-full", k <= i ? "bg-accent" : "bg-surface-3")} />)}
            </div>
            <article key={i} className="animate-enter rounded-2xl border border-line bg-surface p-5">
              <p className="text-[12px] font-semibold tracking-[0.08em] text-fg-3 uppercase">Card {i + 1} of {lesson.cards.length}</p>
              <h3 className="mt-1 text-[18px] font-semibold">{lesson.cards[i]!.title}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {lesson.cards[i]!.lines.map((l) => (
                  <li key={l} className="flex gap-2 text-[15px] leading-6"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><span><Rich text={l} /></span></li>
                ))}
              </ul>
              {lesson.cards[i]!.remember && <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] font-medium text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">💡 Remember: {lesson.cards[i]!.remember}</p>}
            </article>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => (i > 0 ? setI(i - 1) : ids.length > 1 ? setWhich(null) : close())} className="h-11 rounded-full px-4 text-[14px] font-medium text-fg-2 hover:bg-surface-3">← Back</button>
              {i + 1 < lesson.cards.length ? (
                <button type="button" autoFocus onClick={() => { tap(); setI(i + 1); }} className="h-11 rounded-full bg-accent px-6 text-[14.5px] font-semibold text-on-accent">Next →</button>
              ) : (
                <button type="button" onClick={() => { tap(); close(); }} className="h-11 rounded-full bg-accent px-6 text-[14.5px] font-semibold text-on-accent">Start practising ✓</button>
              )}
            </div>
            </>)}
            <p className="text-[11.5px] text-fg-3">📚 {lesson.source}</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
