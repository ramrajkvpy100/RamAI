"use client";

import { useEffect, useState } from "react";

import { FillingBar } from "@/components/ui/filling-bar";
import { Icon } from "@/components/ui/icon";
import type { CaseDebrief, LearnPack, Mcq } from "@/engine/types";
import { cn } from "@/lib/cn";
import { answerMcq, fetchCoach, fetchLearn } from "@/lib/engine-client";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** One question: tap an answer — it's marked at once, with the explanation. */
function Question({ q, n, token, onAnswered }: { q: Mcq; n: number; token: string; onAnswered: (correct: boolean) => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const answered = chosen !== null;
  const choose = (i: number) => {
    if (answered) return;
    setChosen(i);
    onAnswered(i === q.answer);
    // Recorded for progress; the key the page already has decides what's shown.
    void answerMcq(token, n, i).catch(() => undefined);
  };
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
        <span className="rounded-full bg-surface-3 px-2.5 py-0.5 font-semibold text-fg-2 tabular">Q{n + 1}</span>
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-medium text-accent-text">{q.topic}</span>
        <span className="text-fg-3 capitalize">{q.difficulty}</span>
      </div>
      <p className="mt-3 text-[15px] leading-7 text-pretty">{q.stem}</p>
      <ol className="mt-3 flex flex-col gap-2">
        {q.options.map((option, i) => {
          const right = answered && i === q.answer;
          const wrong = answered && i === chosen && i !== q.answer;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={answered}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[14px] leading-6 transition-colors",
                  right ? "border-success bg-success-soft" : wrong ? "border-danger bg-danger-soft" : answered ? "border-line-2 bg-surface opacity-70" : "border-line bg-surface hover:border-accent-line hover:bg-surface-2",
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", right ? "bg-success text-white" : wrong ? "bg-danger text-white" : "bg-surface-3 text-fg-2")}>
                  {right ? <Icon name="check" size={13} strokeWidth={2.6} /> : wrong ? <Icon name="x" size={13} strokeWidth={2.6} /> : LETTERS[i]}
                </span>
                <span className="min-w-0">{option}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {answered && (
        <div className="mt-3 animate-enter rounded-xl bg-surface-2 px-4 py-3">
          <div className={cn("text-[12.5px] font-semibold", chosen === q.answer ? "text-success" : "text-danger")}>{chosen === q.answer ? "Correct" : `The answer is ${LETTERS[q.answer]}`}</div>
          <p className="mt-1 text-[14px] leading-6 text-fg-2">{q.explanation}</p>
        </div>
      )}
    </li>
  );
}

/** After the case: pearls and exam-style questions — written by AI and checked by an AI examiner. */
export function LearnSection({ token }: { token: string }) {
  const [pack, setPack] = useState<LearnPack | null | undefined>(undefined);
  const [right, setRight] = useState(0);
  const [done, setDone] = useState(0);
  /** The case's questions fold away until wanted. */
  const [mcqsOpen, setMcqsOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetchLearn(token)
      .then((r) => live && setPack(r.pack))
      .catch(() => live && setPack(null));
    return () => {
      live = false;
    };
  }, [token]);

  if (pack === null) return null;
  return (
    <section className="mt-10 animate-rise" aria-labelledby="learn-heading">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="learn-heading" className="micro text-fg-2">
          Learn from this case
        </h2>
        {pack && <span className="text-[12px] text-fg-3">{pack.exam} style · written by AI, checked by an AI examiner</span>}
      </div>
      {pack === undefined ? (
        <div className="card flex flex-col gap-3 p-5 text-[14px] text-fg-2" role="status">
          <span className="flex items-center gap-3">
            <span className="bg-ai flex h-8 w-8 animate-pulse items-center justify-center rounded-lg text-white">
              <Icon name="sparkles" size={15} />
            </span>
            Writing your clinical pearls and exam questions…
          </span>
          <FillingBar active expectedMs={15_000} label="Writing your pearls and questions" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="panel p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <Icon name="bulb" size={16} className="text-warning" /> Clinical pearls
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {pack.pearls.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[14.5px] leading-6">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            aria-expanded={mcqsOpen}
            aria-controls="case-mcqs"
            onClick={() => setMcqsOpen((o) => !o)}
            className="panel flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2"
          >
            <span>
              <span className="block text-[15px] font-semibold">Exam practice · {pack.exam}</span>
              <span className="block text-[13px] text-fg-2 tabular">{done > 0 ? `${right} of ${done} right` : `${pack.mcqs.length} questions on this case`}</span>
            </span>
            <Icon name="chevron-down" size={18} className={cn("shrink-0 text-fg-2 transition-transform", mcqsOpen && "rotate-180")} />
          </button>
          <ol id="case-mcqs" hidden={!mcqsOpen} className="flex flex-col gap-3">
            {pack.mcqs.map((q, i) => (
              <Question
                key={i}
                q={q}
                n={i}
                token={token}
                onAnswered={(ok) => {
                  setDone((d) => d + 1);
                  if (ok) setRight((r) => r + 1);
                }}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** The AI's feedback in words arrives after the debrief — the score never waits for it. */
export function useCoach(token: string, initial: CaseDebrief["coach"]): { coach: CaseDebrief["coach"]; writing: boolean } {
  const [coach, setCoach] = useState(initial);
  const [writing, setWriting] = useState(!initial);
  useEffect(() => {
    if (initial) return;
    let live = true;
    fetchCoach(token)
      .then((r) => live && setCoach(r.coach ?? undefined))
      .catch(() => undefined)
      .finally(() => live && setWriting(false));
    return () => {
      live = false;
    };
  }, [token, initial]);
  return { coach, writing };
}
