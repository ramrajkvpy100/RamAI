"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { CaseState } from "@/engine/types";
import { cn } from "@/lib/cn";

/**
 * The guided demo case's tips. Each step is worked out from the case itself,
 * so it survives a reload and moves on as soon as the player has done it.
 * While a step is showing, the part of the screen it's about gently pulses
 * (elements marked with data-coach-target).
 */

interface Step {
  id: string;
  title: string;
  body: React.ReactNode;
  target: "composer" | "condition" | "end-case";
  done: (s: CaseState) => boolean;
}

const HISTORY = ["complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "systemic"];
const historyFacts = (s: CaseState) => s.facts.filter((f) => HISTORY.includes(f.group)).length;
const measuredRbsAgain = (s: CaseState) => (s.vitals.rbs?.history.length ?? 0) > 0;

const Q = ({ children }: { children: React.ReactNode }) => <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-medium text-fg">{children}</span>;

const STEPS: Step[] = [
  {
    id: "talk",
    title: "Talk to the family",
    body: (
      <>
        His wife is with him. Ask what happened in your own words — try <Q>What happened?</Q> — or tap <b>Ask</b> for ideas.
      </>
    ),
    target: "composer",
    done: (s) => historyFacts(s) >= 1,
  },
  {
    id: "history",
    title: "Find the cause",
    body: (
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
    body: (
      <>
        A confused, sweaty diabetic needs his sugar checked first. Type <Q>Check RBS</Q>, or tap <b>Examine</b>.
      </>
    ),
    target: "composer",
    done: (s) => !!s.vitals.rbs,
  },
  {
    id: "treat",
    title: "Treat it — now",
    body: (
      <>
        RBS 42 is dangerously low. Sugar into the vein: <Q>Give 25% dextrose 100 mL IV</Q>, or use <b>Treat</b>.
      </>
    ),
    target: "composer",
    done: (s) => s.drugs.length > 0 || s.patientStatus === "improving",
  },
  {
    id: "watch",
    title: "Watch him respond",
    body: (
      <>
        See the condition bar and the monitor move, and hear him wake up. Confirm it: <Q>Recheck RBS</Q>.
      </>
    ),
    target: "condition",
    done: (s) => measuredRbsAgain(s) || s.messages.filter((m) => m.role === "doctor").length >= 9,
  },
  {
    id: "finish",
    title: "Make a plan, then finish",
    body: (
      <>
        Glimepiride lows come back for hours. A good plan: <Q>Start 10% dextrose infusion</Q> <Q>Stop glimepiride</Q> <Q>Admit</Q>. Then tap <b>End case</b> for your score and debrief.
      </>
    ),
    target: "end-case",
    done: (s) => s.status !== "active",
  },
];

const HIDE_KEY = "ramai.coach.hidden";

export function Coach({ state, className }: { state: CaseState; className?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(HIDE_KEY) === state.sessionId);
    } catch {}
  }, [state.sessionId]);

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
          <p className="mt-1 text-[13px] leading-[1.7] text-fg-2">{step.body}</p>
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
