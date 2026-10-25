"use client";

import { Rich, RichLines } from "@/components/ui/rich-lines";
import { ExplainMore } from "./explain-more";
import { ReportProblem } from "@/components/case/report-problem";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import type { QuizQuestion } from "@/lib/skills";

/** A set of questions: pick one, see why — and why not the others — then the next. */
export function QuizDrill({ make, title }: { make: () => QuizQuestion[]; title: string }) {
  const [qs, setQs] = useState<QuizQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<QuizQuestion[]>([]);
  const restart = (set: QuizQuestion[]) => { setQs(set); setI(0); setScore(0); setPicked(null); setWrong([]); };
  // Made in the browser only: the numbers are random, so the server's copy would never match.
  useEffect(() => setQs(make()), [make]);
  if (!qs) return <div className="card h-64 animate-pulse" aria-busy="true" />;
  const q = qs[i];
  if (!q)
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <div className="text-[44px] font-bold tabular">{score}/{qs.length}</div>
        <p className="text-[14px] text-fg-2">{title} — correct</p>
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && <button type="button" onClick={() => restart(wrong)} className="h-11 rounded-full bg-accent px-6 text-[14px] font-semibold text-on-accent">↻ Replay the {wrong.length} wrong</button>}
          <button type="button" onClick={() => restart(make())} className={cn("h-11 rounded-full px-6 text-[14px] font-semibold", wrong.length ? "bg-surface-3" : "bg-accent text-on-accent")}>Another set</button>
        </div>
      </div>
    );
  return (
    <article className="card flex flex-col gap-4 p-5">
      <div className="text-[12px] text-fg-3 tabular">Question {i + 1} of {qs.length}</div>
      <p className="text-[16px] leading-7 font-medium"><Rich text={q.stem} /></p>
      <div className="grid gap-2">
        {q.options.map((o, n) => {
          const state = picked === null ? "idle" : n === q.answer ? "right" : n === picked ? "wrong" : "other";
          return (
            <button key={o} type="button" disabled={picked !== null} onClick={() => { setPicked(n); if (n === q.answer) setScore((s) => s + 1); else setWrong((w) => [...w, q]); }} className={cn("min-h-12 rounded-xl border px-4 py-2.5 text-left text-[14.5px]", state === "right" ? "border-success bg-success-soft" : state === "wrong" ? "border-danger bg-danger-soft" : "border-line bg-surface hover:bg-surface-2", state === "other" && "opacity-60")}>
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <section className="selectable animate-enter rounded-xl border border-line p-4">
          <div className={cn("text-[14px] font-semibold", picked === q.answer ? "text-success" : "text-danger")}>{picked === q.answer ? "Correct" : `Answer: ${q.options[q.answer]}`}</div>
          <RichLines text={q.explain} className="mt-1 text-[14px]" />
          {picked !== q.answer && q.whyNot?.[picked] && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13.5px] leading-6 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100"><b>Why not {q.options[picked]}?</b> {q.whyNot[picked]}</p>
          )}
          <p className="mt-2 text-[12px] font-semibold text-amber-700 dark:text-amber-300">📚 {q.source}</p>
          <ExplainMore key={q.id + i} drill={title} question={q.stem} options={q.options} answer={q.options[q.answer]!} explanation={q.explain} />
          <div className="mt-3 flex items-center justify-between gap-2">
            <ReportProblem compact target={{ area: "skills", ref: `${title} · ${q.stem.slice(0, 90)}`, details: `${q.stem}\n\nOptions: ${q.options.map((o, n) => `${n === q.answer ? "✓ " : ""}${o}`).join(" | ")}\n\nExplanation: ${q.explain}\nSource: ${q.source}` }} />
            <button type="button" onClick={() => { setPicked(null); setI(i + 1); }} autoFocus className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">{i + 1 < qs.length ? "Next" : "See your score"}</button>
          </div>
        </section>
      )}
    </article>
  );
}
