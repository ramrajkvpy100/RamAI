"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { glucoseLabel } from "@/engine/countries";
import type { CaseState } from "@/engine/types";
import { cn } from "@/lib/cn";
import { demoScript, type DemoScript } from "@/lib/demo-script";

/**
 * The guided demo case's tips. Each step is worked out from the case itself,
 * so it survives a reload and moves on as soon as the player has done it.
 * While a step is showing, the part of the screen it's about gently pulses
 * (elements marked with data-coach-target).
 */

interface Step {
  id: string;
  title: string;
  body: (t: DemoScript, s: CaseState) => React.ReactNode;
  target: "composer" | "condition" | "end-case";
  done: (s: CaseState) => boolean;
}

const HISTORY = ["complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "systemic"];
const historyFacts = (s: CaseState) => s.facts.filter((f) => HISTORY.includes(f.group)).length;
const measuredRbsAgain = (s: CaseState) => (s.vitals.rbs?.history.length ?? 0) > 0;
const doctorTurns = (s: CaseState) => s.messages.filter((m) => m.role === "doctor").length;
const examinedNeuro = (s: CaseState) => s.facts.some((f) => f.group === "systemic-exam" && /neuro|cns/i.test(f.label));
const listened = (s: CaseState) => s.messages.some((m) => m.stethoscope);
const gaveDrip = (s: CaseState) => s.drugs.some((d) => /10%|d10/i.test(`${d.generic} ${d.brand ?? ""}`));
const named = (s: CaseState) => !!s.workingDiagnosis;
const hinted = (s: CaseState) => s.messages.some((m) => m.text.startsWith("💡 Hint"));
const opined = (s: CaseState) => s.messages.some((m) => m.role === "system" && /— seen the patient/.test(m.text));

/** Something to try: tap it and it's done, exactly as if typed. */
const TryContext = createContext<{ onTry?: (text: string) => void; busy?: boolean }>({});

function Q({ children, done }: { children: string; done?: boolean }) {
  const { onTry, busy } = useContext(TryContext);
  if (done)
    return (
      <span className="mx-0.5 my-0.5 inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-success">
        <Icon name="check" size={11} strokeWidth={2.4} /> {children}
      </span>
    );
  if (!onTry) return <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-medium text-fg">{children}</span>;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onTry(children)}
      className="mx-0.5 my-0.5 inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-left text-[12.5px] font-semibold text-accent-text transition-transform hover:-translate-y-px active:scale-[0.97] disabled:opacity-50"
    >
      {children}
      <Icon name="arrow-right" size={11} />
    </button>
  );
}

const INTRO_KEY = "ramai.coach.intro";

/** Eight short steps — every part of a case and every helper, one tap each. Follow them and he walks out well. */
const STEPS: Step[] = [
  {
    id: "talk",
    title: "Talk to the family",
    body: (t) => (
      <>
        His wife brought him in. One tap asks several things at once: <Q>{t.talk}</Q> Or type in your own words — more questions are under <b>Ask</b>.
      </>
    ),
    target: "composer",
    done: (s) => historyFacts(s) >= 3,
  },
  {
    id: "check",
    title: "Check his sugar",
    body: (t) => (
      <>
        Confused and sweaty in a diabetic: check the sugar first. <Q>{t.check}</Q> All tests are under <b>Tests</b>.
      </>
    ),
    target: "composer",
    done: (s) => !!s.vitals.rbs,
  },
  {
    id: "treat",
    title: "Treat it — now",
    body: (t, s) => (
      <>
        {glucoseLabel(s.country)} {s.vitals.rbs?.current.value ?? "42"} is dangerously low. Sugar into the vein: <Q>{t.bolus}</Q> Drugs and fluids are under <b>Treat</b>.
      </>
    ),
    target: "composer",
    done: (s) => s.drugs.length > 0 || s.patientStatus === "improving",
  },
  {
    id: "watch",
    title: "Watch him wake up",
    body: (t) => (
      <>
        The monitor and the condition bar move with what you do. Make sure it worked: <Q>{t.recheck}</Q>
      </>
    ),
    target: "condition",
    done: (s) => measuredRbsAgain(s) || doctorTurns(s) >= 9,
  },
  {
    id: "examine",
    title: "Examine him",
    body: (t, s) => (
      <>
        Now look for anything else: <Q done={examinedNeuro(s)}>{t.examine}</Q> Then the stethoscope: <Q done={listened(s)}>{t.listen}</Q>
        {listened(s) && <> — tap <b>Listen</b> on the card to hear it (headphones help).</>}
      </>
    ),
    target: "composer",
    done: (s) => examinedNeuro(s) && listened(s),
  },
  {
    id: "helpers",
    title: "Two helpers",
    body: (t, s) => (
      <>
        Stuck in a real case? <Q done={hinted(s)}>{t.hint}</Q> points to the next step. Want a specialist&apos;s view? <Q done={opined(s)}>{t.opinion}</Q> Both are always beside <b>Ask</b>.
      </>
    ),
    target: "composer",
    done: (s) => hinted(s) && opined(s),
  },
  {
    id: "plan",
    title: "Plan, then name it",
    body: (t, s) => (
      <>
        Glimepiride lows come back for hours. The plan in one tap: <Q done={gaveDrip(s)}>{t.plan}</Q> Then say what it is: <Q done={named(s)}>{t.diagnosis}</Q>
      </>
    ),
    target: "composer",
    done: (s) => gaveDrip(s) && named(s),
  },
  {
    id: "finish",
    title: "Finish the case",
    body: () => (
      <>
        Well done — he&apos;s safe. Tap <b>End case</b> for your score out of 100 and what you did well.
      </>
    ),
    target: "end-case",
    done: (s) => s.status !== "active",
  },
];

/** The step to show: the one after the furthest the player has got — doing things out of order never leaves them stuck. */
function currentStep(state: CaseState): number {
  let furthest = -1;
  STEPS.forEach((s, i) => {
    if (s.done(state)) furthest = i;
  });
  const next = STEPS.findIndex((s, i) => i > furthest && !s.done(state));
  return next;
}

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

  const index = useMemo(() => currentStep(state), [state]);
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
            <p className="mt-2 text-[12.5px] text-fg-3">In this demo, a tip shows the next step — just tap the blue suggestion. Real cases have no tips.</p>
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
            <p className="mt-1 text-[13px] leading-[1.9] text-fg-2">{step.body(demoScript(state.country ?? "IN"), state)}</p>
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
