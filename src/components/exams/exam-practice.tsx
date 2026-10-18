"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FillingBar } from "@/components/ui/filling-bar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { ClinicalEngineError, examAnswer, examSet } from "@/lib/engine-client";
import { EXAM_STYLES, EXAMS, MIXED, type ExamId, type ExamSet, type ExamStats, type ExamStyle } from "@/lib/exams";
import { playSfx } from "@/lib/sfx";

type Checked = { choice: number; correct: boolean; answer: number; explanation: string };

const LETTERS = "ABCDE";
const pct = (c: number, n: number) => (n ? Math.round((c / n) * 100) : 0);

/** One exam: pick a subject (or a mix), answer a set of ten, see why after each — and how you're doing, by subject. */
export function ExamPractice({ exam, stats: initialStats }: { exam: ExamId; stats: ExamStats | null }) {
  const info = EXAMS[exam];
  // A subject named in the link (?subject=Medicine, from a debrief) is picked to start with.
  const [subject, setSubject] = useState<string>(MIXED);
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("subject");
    if (asked && info.subjects.includes(asked)) setSubject(asked);
  }, [info.subjects]);
  const [style, setStyle] = useState<ExamStyle>("pyq");
  const [set, setSet] = useState<ExamSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Record<number, Checked>>({});
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(initialStats);
  /** The score shows once they've read the last explanation. */
  const [scored, setScored] = useState(false);

  const start = async (s = subject) => {
    setLoading(true);
    setError(null);
    try {
      const { set } = await examSet(exam, s, style);
      setSet(set);
      setIndex(0);
      setChecked({});
      setScored(false);
    } catch (err) {
      setError(err instanceof ClinicalEngineError ? err.message : "The questions couldn't be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const choose = async (choice: number) => {
    if (!set || checked[index] || busy) return;
    setBusy(true);
    try {
      const r = await examAnswer(set.id, index, choice);
      setChecked((c) => ({ ...c, [index]: { choice, ...r } }));
      playSfx(r.correct ? "correct" : "wrong");
      // Their own tally, kept apart from cases, XP and rank.
      setStats((st) => {
        const base = st ?? { answered: 0, correct: 0, subjects: [] };
        const row = base.subjects.find((x) => x.subject === set.subject) ?? { subject: set.subject, answered: 0, correct: 0 };
        const updated = { ...row, answered: row.answered + 1, correct: row.correct + (r.correct ? 1 : 0) };
        return { answered: base.answered + 1, correct: base.correct + (r.correct ? 1 : 0), subjects: [updated, ...base.subjects.filter((x) => x.subject !== set.subject)] };
      });
    } catch (err) {
      setError(err instanceof ClinicalEngineError ? err.message : "That answer didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const done = set ? Object.keys(checked).length : 0;
  const right = Object.values(checked).filter((c) => c.correct).length;
  const finished = !!set && scored && done === set.questions.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/exams" className="flex items-center gap-1.5 text-[13px] font-medium text-fg-2 hover:text-fg">
            <Icon name="arrow-left" size={13} /> Exam practice
          </Link>
          <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.025em] sm:text-[34px]">{info.label} practice</h1>
          <p className="mt-1 text-[14px] text-fg-2">
            Single best answer, {info.options} options · written by AI and checked by an AI examiner · not counted in your XP or rank
          </p>
        </div>
        {stats && stats.answered > 0 && (
          <div className="rounded-2xl bg-surface-2 px-4 py-2.5 text-right ring-1 ring-line">
            <div className="text-[22px] font-semibold tabular">{pct(stats.correct, stats.answered)}%</div>
            <div className="text-[12px] text-fg-2 tabular">
              {stats.correct} of {stats.answered} right
            </div>
          </div>
        )}
      </div>

      {!set && (
        <div className="panel flex flex-col gap-4 p-5 sm:p-6">
          <div role="radiogroup" aria-label="Question style" className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(EXAM_STYLES) as ExamStyle[]).map((id) => (
              <button key={id} type="button" role="radio" aria-checked={style === id} onClick={() => setStyle(id)} className={cn("flex flex-col items-start rounded-xl border px-4 py-3 text-left", style === id ? "border-accent-line bg-accent-soft" : "border-line hover:bg-surface-2")}>
                <span className="text-[14.5px] font-semibold">{EXAM_STYLES[id].label}</span>
                <span className="mt-0.5 text-[12.5px] leading-5 text-fg-2">{EXAM_STYLES[id].note}</span>
              </button>
            ))}
          </div>
          <label htmlFor="subject" className="text-[14px] font-semibold">
            Subject
          </label>
          <select
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-11 rounded-xl border border-line bg-surface px-3 text-[15px] outline-none focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <option value={MIXED}>Mixed — every subject</option>
            {info.subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {stats && stats.subjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stats.subjects.slice(0, 6).map((s) => (
                <button key={s.subject} type="button" onClick={() => setSubject(s.subject)} className="rounded-full bg-surface-3 px-3 py-1 text-[12.5px] text-fg-2 hover:text-fg">
                  {s.subject} · {pct(s.correct, s.answered)}%
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => void start()} disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-[14.5px] font-semibold text-on-accent disabled:opacity-60">
            {loading ? "Preparing your questions…" : "Start 10 questions"}
          </button>
          {loading && <FillingBar active expectedMs={35_000} label="Writing and checking the questions" />}
          {loading && <p className="text-[12.5px] text-fg-3">A new set is written and checked by an examiner — this can take up to a minute. The next one will be ready at once.</p>}
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
              <Icon name="alert" size={15} /> {error}
            </p>
          )}
        </div>
      )}

      {set?.repeat && !finished && index === 0 && (
        <p role="status" className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning">
          New questions can&apos;t be written just now, so here&apos;s a set you&apos;ve done before — good for revision.
        </p>
      )}
      {set && !finished && (
        <Question
          key={`${set.id}-${index}`}
          n={index}
          total={set.questions.length}
          q={set.questions[index]!}
          checked={checked[index]}
          busy={busy}
          onChoose={(c) => void choose(c)}
          onNext={() => {
            if (index + 1 < set.questions.length) return setIndex(index + 1);
            setScored(true);
            playSfx(right >= set.questions.length / 2 ? "win" : "streak");
          }}
          subject={set.subject}
          right={right}
        />
      )}

      {set && finished && (
        <div className="panel flex flex-col items-center gap-3 p-6 text-center">
          <div className="text-[44px] font-semibold tabular">
            {right}/{set.questions.length}
          </div>
          <p className="text-[14.5px] text-fg-2">{right >= 8 ? "Excellent — exam-ready on this set." : right >= 5 ? "Good work. Read the explanations of the ones you missed." : "Keep at it — the explanations are where the marks are."}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void start(set.subject)} disabled={loading} className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-60">
              {loading ? "Loading…" : "Next 10 questions"}
            </button>
            <button type="button" onClick={() => setSet(null)} className="h-10 rounded-full bg-surface-3 px-5 text-[14px] font-medium">
              Change subject
            </button>
          </div>
          {loading && <FillingBar active expectedMs={20_000} label="Preparing the next set" className="w-full max-w-xs" />}
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Question({
  n,
  total,
  q,
  checked,
  busy,
  onChoose,
  onNext,
  subject,
  right,
}: {
  n: number;
  total: number;
  q: ExamSet["questions"][number];
  checked?: Checked;
  busy: boolean;
  onChoose: (c: number) => void;
  onNext: () => void;
  subject: string;
  right: number;
}) {
  return (
    <div className="panel flex animate-enter flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between text-[12.5px] text-fg-2 tabular">
        <span>
          Question {n + 1} of {total} · {subject === MIXED ? q.topic : subject}
          {q.pattern && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-accent-text">{q.pattern} · recall-based</span>}
        </span>
        <span>{right} right</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((n + (checked ? 1 : 0)) / total) * 100}%` }} />
      </div>
      <p className="text-[16px] leading-7 whitespace-pre-wrap">{q.stem}</p>
      <ol className="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const state = !checked ? "idle" : i === checked.answer ? "right" : i === checked.choice ? "wrong" : "other";
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!!checked || busy}
                onClick={() => onChoose(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[14.5px] leading-6 transition-colors",
                  state === "idle" && "border-line bg-surface hover:border-accent-line hover:bg-accent-soft",
                  state === "right" && "border-success bg-success-soft",
                  state === "wrong" && "border-danger bg-danger-soft",
                  state === "other" && "border-line bg-surface opacity-60",
                )}
              >
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", state === "right" ? "bg-success text-white" : state === "wrong" ? "bg-danger text-white" : "bg-surface-3 text-fg-2")}>
                  {state === "right" ? <Icon name="check" size={13} /> : state === "wrong" ? <Icon name="x" size={13} /> : LETTERS[i]}
                </span>
                <span>{o}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {checked && (
        <div className="animate-enter rounded-xl bg-surface-2 p-4">
          <div className={cn("text-[14px] font-semibold", checked.correct ? "text-success" : "text-danger")}>{checked.correct ? "Correct" : `The answer is ${LETTERS[checked.answer]}`}</div>
          <p className="mt-1.5 text-[14px] leading-6 whitespace-pre-wrap text-fg">{checked.explanation}</p>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={onNext} autoFocus className="h-10 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent">
              {n + 1 < total ? "Next question" : "See your score"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
