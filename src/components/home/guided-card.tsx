"use client";

import { PatientFigure } from "@/components/game/caricature";
import { Icon } from "@/components/ui/icon";
import type { PatientIdentity } from "@/engine/types";

const DEMO_PATIENT: PatientIdentity = { name: "Demo patient", age: 62, sex: "Male", city: "", occupation: "", context: "Emergency" };

/** For doctors who haven't finished a case yet: the guided demo, front and centre. */
export function GuidedCard({ onStart, onSkip, starting }: { onStart: () => void; onSkip: () => void; starting: boolean }) {
  return (
    <section className="panel relative flex animate-rise flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:p-6" aria-labelledby="guided-heading">
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,var(--mesh-1),transparent_70%)]" />
      <span className="relative shrink-0 self-start rounded-full bg-surface p-1 shadow-md ring-1 ring-line sm:self-center">
        <PatientFigure patient={DEMO_PATIENT} status="deteriorating" seed="guided-demo" size={68} />
        <span className="bg-ai absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full text-white ring-2 ring-surface">
          <Icon name="sparkles" size={13} />
        </span>
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold tracking-[0.12em] text-accent-text uppercase">New here? Start with this</div>
        <h2 id="guided-heading" className="mt-1 text-[19px] leading-snug font-semibold tracking-[-0.01em]">
          A 3-minute guided case
        </h2>
        <p className="mt-1 text-[13.5px] leading-6 text-fg-2">A confused, sweaty diabetic in the ER. Tips show you how to ask, examine, test and treat. It doesn&apos;t use one of your free cases.</p>
      </div>
      <div className="relative flex shrink-0 items-center gap-2">
        <button type="button" onClick={onStart} disabled={starting} className="shine inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-glow disabled:opacity-70">
          {starting ? "Preparing…" : "Start guided case"} {!starting && <Icon name="arrow-right" size={15} />}
        </button>
        <button type="button" onClick={onSkip} className="h-11 rounded-full px-3 text-[13px] font-medium text-fg-3 hover:text-fg">
          Skip
        </button>
      </div>
    </section>
  );
}
