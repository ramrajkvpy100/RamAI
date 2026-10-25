"use client";

import type { Me } from "@/lib/me-store";

const RINGS = [
  { key: "triage", label: "Triage & stabilisation", color: "#f43f5e" },
  { key: "diagnosis", label: "Diagnostic precision", color: "#22c55e" },
  { key: "treatment", label: "Treatment & safety", color: "#38bdf8" },
] as const;

/** Today's three competence rings (two good cases close them), the clinical rating, and streak freezes left. */
export function CompetenceRings({ me }: { me: Me }) {
  const r = me.rings ?? { triage: 0, diagnosis: 0, treatment: 0, cases: 0 };
  const p = me.progress;
  const size = 112, stroke = 11;
  return (
    <section className="panel flex animate-rise items-center gap-5 p-4 [animation-delay:80ms] sm:p-5" aria-label="Today's competence rings">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
        {RINGS.map((ring, i) => {
          const rad = size / 2 - stroke / 2 - i * (stroke + 3);
          const c = 2 * Math.PI * rad;
          const v = Math.max(0, Math.min(1, r[ring.key]));
          return (
            <g key={ring.key}>
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={ring.color} strokeOpacity={0.16} strokeWidth={stroke} />
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={ring.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} className="transition-[stroke-dasharray] duration-1000 ease-out" />
            </g>
          );
        })}
      </svg>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">Today&apos;s rings</h2>
        <ul className="mt-1.5 flex flex-col gap-1">
          {RINGS.map((ring) => (
            <li key={ring.key} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ring.color }} />
              <span className="min-w-0 flex-1 truncate text-fg-2">{ring.label}</span>
              <span className="font-semibold tabular">{Math.round(r[ring.key] * 100)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-fg-2">
          <span title="Like a chess rating: rises with good scores on harder cases">📈 Rating <b className="text-fg tabular">{p.rating ?? 1200}</b></span>
          <span title="Missed days forgiven automatically this month">🧊 {p.freezesLeft ?? 2} streak freeze{(p.freezesLeft ?? 2) === 1 ? "" : "s"} left</span>
        </p>
        {r.cases < 2 && <p className="mt-1 text-[11.5px] text-fg-3">{r.cases === 0 ? "Two good cases today close all three rings." : "One more case to close today's rings."}</p>}
      </div>
    </section>
  );
}
