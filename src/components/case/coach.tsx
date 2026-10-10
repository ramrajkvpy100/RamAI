"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { glucoseLabel, type Country } from "@/engine/countries";
import type { CaseState } from "@/engine/types";
import { cn } from "@/lib/cn";

/**
 * The guided demo case's tips. Each step is worked out from the case itself,
 * so it survives a reload and moves on as soon as the player has done it.
 * While a step is showing, the part of the screen it's about gently pulses
 * (elements marked with data-coach-target).
 */

/** What to type, in the words used where the case is set. */
interface Words {
  check: string;
  recheck: string;
  bolus: string;
  drip: string;
}

const WORDS: Record<Country, Words> = {
  IN: { check: "Check RBS", recheck: "Recheck RBS", bolus: "Give 25% dextrose 100 mL IV", drip: "Start 10% dextrose infusion" },
  US: { check: "Check glucose", recheck: "Recheck glucose", bolus: "Give D50 50 mL IV", drip: "Start D10 infusion" },
  UK: { check: "Check CBG", recheck: "Recheck CBG", bolus: "Give 20% glucose 100 mL IV", drip: "Start 10% glucose infusion" },
};

interface Step {
  id: string;
  title: string;
  body: (w: Words, s: CaseState) => React.ReactNode;
  target: "composer" | "condition" | "end-case";
  done: (s: CaseState) => boolean;
}

const HISTORY = ["complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "systemic"];
const historyFacts = (s: CaseState) => s.facts.filter((f) => HISTORY.includes(f.group)).length;
const measuredRbsAgain = (s: CaseState) => (s.vitals.rbs?.history.length ?? 0) > 0;

/** Something to try: tap it and it's done, exactly as if typed. */
const TryContext = createContext<{ onTry?: (text: string) => void; busy?: boolean }>({});

function Q({ children }: { children: string }) {
  const { onTry, busy } = useContext(TryContext);
  if (!onTry) return <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-medium text-fg">{children}</span>;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onTry(children)}
      className="mx-0.5 my-0.5 inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-accent-text transition-transform hover:-translate-y-px active:scale-[0.97] disabled:opacity-50"
    >
      {children}
      <Icon name="arrow-right" size={11} />
    </button>
  );
}

const INTRO_KEY = "ramai.coach.intro";

const STEPS: Step[] = [
  {
    id: "talk",
    title: "Talk to the family",
    body: (w, s) => (
      <>
        His wife is with him. Ask what happened — tap <Q>What happened?</Q> or type it in your own words. <b>Ask</b> below the box has more ideas.
      </>
    ),
    target: "composer",
    done: (s) => historyFacts(s) >= 1,
  },
  {
    id: "history",
    title: "Find the cause",
    body: (w, s) => (
      <>
        Good. Dig a little deeper: <Q>Is he diabetic?</Q> <Q>What medicines does he take?</Q> <Q>When did he last eat?</Q>
      </>
    ),
    target: "composer",
    done: (s) => historyFacts(s) >= 3 || !!s.vitals.rbs,
  },
  {
    id: "check",
    title: "Check his sugar",
    body: (w, s) => (
      <>
        A confused, sweaty diabetic needs his sugar checked first: tap <Q>{w.check}</Q>, or find it under <b>Examine</b>.
      </>
    ),
    target: "composer",
    done: (s) => !!s.vitals.rbs,
  },
  {
    id: "treat",
    title: "Treat it — now",
    body: (w, s) => (
      <>
        {glucoseLabel(s.country)} {s.vitals.rbs?.current.value ?? "42"} is dangerously low. Sugar into the vein, now: <Q>{w.bolus}</Q> — or choose it under <b>Treat</b>.
      </>
    ),
    target: "composer",
    done: (s) => s.drugs.length > 0 || s.patientStatus === "improving",
  },
  {
    id: "watch",
    title: "Watch him respond",
    body: (w, s) => (
      <>
        See the condition bar and the monitor move, and hear him wake up. Confirm it: <Q>{w.recheck}</Q>.
      </>
    ),
    target: "condition",
    done: (s) => measuredRbsAgain(s) || s.messages.filter((m) => m.role === "doctor").length >= 9,
  },
  {
    id: "finish",
    title: "Make a plan, then finish",
    body: (w, s) => (
      <>
        Glimepiride lows come back for hours. A good plan: <Q>{w.drip}</Q> <Q>Stop glimepiride</Q> <Q>Admit</Q>. Then tap <b>End case</b> for your score and debrief.
      </>
    ),
    target: "end-case",
    done: (s) => s.status !== "active",
  },
];

const HIDE_KEY = "ramai.coach.hidden";

export function Coach({ state, className, onTry, busy }: { state: CaseState; className?: string; onTry?: (text: string) => void; busy?: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [introDone, setIntroDone] = useState(true);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(HIDE_KEY) === state.sessionId);
      setIntroDone(sessionStorage.getItem(INTRO_KEY) === state.sessionId);
    } catch {}
  }, [state.sessionId]);
  const finishIntro = () => {
    setIntroDone(true);
    try {
      sessionStorage.setItem(INTRO_KEY, state.sessionId);
    } catch {}
  };

  const index = useMemo(() => STEPS.findIndex((s) => !s.done(state)), [state]);
  const step = index >= 0 ? STEPS[index] : undefined;
  const active = !!state.guided && !hidden && !!step && state.status === "active";

  // Point at the part of the screen this step is about.
  useEffect(() => {
    const root = document.documentElement;
    if (active && step) root.dataset.coach = step.target;
    else delete root.dataset.coach;
    return () => {
      delete root.dataset.coach;
    };
  }, [active, step]);

  if (!active || !step) return null;
  // Before the first step: how a case works, in three lines.
  if (!introDone && index === 0 && state.messages.filter((m) => m.role === "doctor").length === 0) {
    return (
      <div role="dialog" aria-label="How a case works" className={cn("relative overflow-hidden rounded-2xl border border-accent-line bg-surface p-4 shadow-md", className)}>
        <div className="flex animate-enter items-start gap-3">
          <span className="bg-ai flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-glow">
            <Icon name="sparkles" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold">How a case works</div>
            <ol className="mt-2 flex flex-col gap-1.5 text-[13px] leading-5 text-fg-2">
              <li>
                <b className="text-fg">1. Talk, examine, test and treat</b> — type what you&apos;d say or do in plain English, or use <b>Ask</b>, <b>Examine</b>, <b>Tests</b> and{" "}
                <b>Treat</b> below the box.
              </li>
              <li>
                <b className="text-fg">2. Watch the patient</b> — the monitor and condition change with what you do. Time passes with every action.
              </li>
              <li>
                <b className="text-fg">3. End the case</b> — for your score out of 100 and exactly what you missed.
              </li>
            </ol>
            <p className="mt-2 text-[12.5px] text-fg-3">In this demo, tips guide every step — tap a suggestion to try it. Real cases have no hints.</p>
            <button type="button" onClick={finishIntro} className="bg-ai mt-3 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white shadow-glow">
              Got it — start <Icon name="arrow-right" size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }
  const hide = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(HIDE_KEY, state.sessionId);
    } catch {}
  };

  return (
    <div role="status" aria-live="polite" className={cn("relative overflow-hidden rounded-2xl border border-accent-line bg-surface p-3.5 shadow-md", className)}>
      <div key={step.id} className="flex animate-enter items-start gap-3">
        <span className="bg-ai flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-glow">
          <Icon name="sparkles" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold">{step.title}</span>
            <span className="text-[11.5px] text-fg-3 tabular">
              {index + 1}/{STEPS.length}
            </span>
          </div>
          <TryContext.Provider value={{ onTry, busy }}>
            <p className="mt-1 text-[13px] leading-[1.9] text-fg-2">{step.body(WORDS[state.country ?? "IN"], state)}</p>
          </TryContext.Provider>
        </div>
        <button type="button" onClick={hide} className="shrink-0 rounded-full px-2 py-1 text-[12px] font-medium text-fg-3 hover:bg-surface-3 hover:text-fg">
          Hide tips
        </button>
      </div>
      <div aria-hidden className="mt-3 flex gap-1">
        {STEPS.map((s, i) => (
          <span key={s.id} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", i < index ? "bg-accent" : i === index ? "bg-accent/50" : "bg-surface-3")} />
        ))}
      </div>
    </div>
  );
}
