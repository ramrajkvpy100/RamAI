"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { CaseSummary } from "@/lib/community";
import { cn } from "@/lib/cn";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="micro text-fg-2">{title}</h3>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: { label: string; value: string; abnormal?: boolean }[] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-[14px] leading-6 sm:grid-cols-[minmax(0,10rem)_1fr]">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-fg-2">{r.label}</dt>
          <dd className={cn("mb-1.5 sm:mb-0", r.abnormal && "font-medium text-fg")}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The case under discussion — what the doctor saw and did, so others can weigh in. The answer waits for "Reveal". */
export function CaseDetails({ summary }: { summary: CaseSummary }) {
  const [revealed, setRevealed] = useState(false);
  const s = summary;
  return (
    <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-line bg-surface-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="file" size={15} className="text-accent-text" /> The case
          </div>
          <p className="mt-1 text-[14px] text-fg">{s.patient}</p>
        </div>
        <span className="text-[12.5px] text-fg-3">{s.setting}</span>
      </div>

      {s.presentation.length > 0 && (
        <Section title="Presentation">
          {s.presentation.map((line, i) => (
            <p key={i} className="text-[14.5px] leading-7">
              {line}
            </p>
          ))}
        </Section>
      )}
      {s.history.length > 0 && (
        <Section title="History taken">
          <Rows rows={s.history} />
        </Section>
      )}
      {s.examination.length > 0 && (
        <Section title="Examination">
          <Rows rows={s.examination} />
        </Section>
      )}
      {s.vitals.length > 0 && (
        <Section title="Vitals">
          <div className="flex flex-wrap gap-2">
            {s.vitals.map((v) => (
              <span key={v.label} className={cn("rounded-lg bg-surface px-2.5 py-1.5 text-[13px] ring-1 ring-line tabular", v.abnormal && "ring-warning")}>
                <span className="text-fg-2">{v.label} </span>
                {v.first === v.last ? v.first : `${v.first} → ${v.last}`}
              </span>
            ))}
          </div>
        </Section>
      )}
      {s.investigations.length > 0 && (
        <Section title="Investigations">
          <Rows rows={s.investigations.map((i) => ({ label: i.name, value: i.findings }))} />
        </Section>
      )}
      {s.management.length > 0 && (
        <Section title="Management given">
          <ul className="flex flex-col gap-1 text-[14px] leading-6">
            {s.management.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {m}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {(s.workingDiagnosis || s.differentials.length > 0) && (
        <Section title="The doctor's thinking">
          {s.workingDiagnosis && <p className="text-[14px]">Working diagnosis: {s.workingDiagnosis}</p>}
          {s.differentials.length > 0 && <p className="text-[14px] text-fg-2">Differentials: {s.differentials.join(", ")}</p>}
        </Section>
      )}

      {revealed ? (
        <div className="animate-enter rounded-xl bg-surface p-4 ring-1 ring-line">
          <div className="micro text-fg-2">The answer</div>
          <p className="mt-1 text-[17px] font-semibold">{s.answer.diagnosis}</p>
          <p className="mt-1 text-[13.5px] text-fg-2">
            {s.answer.verdict} · scored {s.answer.score}/100 · patient {s.answer.outcome.toLowerCase()}
          </p>
        </div>
      ) : (
        <button type="button" onClick={() => setRevealed(true)} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-[13.5px] font-semibold text-fg-2 hover:text-fg">
          <Icon name="eye" size={15} /> Give your opinion first — then reveal the diagnosis
        </button>
      )}
    </div>
  );
}
