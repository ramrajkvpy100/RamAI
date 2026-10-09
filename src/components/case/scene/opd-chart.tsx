import { LEVELS } from "@/engine/levels";
import type { CaseState, VitalKey } from "@/engine/types";
import { cn } from "@/lib/cn";
import { clockAt } from "@/lib/format";

import { tokenNumber } from "./scene";

const ROWS: { k: VitalKey; label: string; unit: string }[] = [
  { k: "bp", label: "BP", unit: "mmHg" },
  { k: "hr", label: "Pulse", unit: "/min" },
  { k: "temp", label: "Temp", unit: "°F" },
  { k: "spo2", label: "SpO₂", unit: "%" },
  { k: "rr", label: "RR", unit: "/min" },
  { k: "rbs", label: "RBS", unit: "mg/dL" },
  { k: "weight", label: "Weight", unit: "kg" },
];

const TONE = { normal: "text-fg", unknown: "text-fg", low: "text-warning", high: "text-warning", critical: "text-danger" } as const;

/** The OPD card: token, facility and a hand-written-style vitals chart. */
export function OpdChart({ state, className }: { state: CaseState; className?: string }) {
  return (
    <section aria-label="Outpatient card" className={cn("overflow-hidden rounded-2xl border border-line bg-surface shadow-sm", className)}>
      <div className="flex items-stretch justify-between gap-3 border-b border-line bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))] px-4 py-3">
        <div className="min-w-0">
          <div className="micro text-accent-text">Outpatient card</div>
          <div className="mt-1 truncate text-[13px] text-fg">{LEVELS[state.level].label}</div>
          <div className="text-[12px] text-fg-3 tabular">Registered {clockAt(state.arrivalMinuteOfDay, 0)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-fg px-3 py-1.5 text-bg">
          <span className="text-[9px] font-medium tracking-[0.14em] uppercase opacity-70">Token</span>
          <span className="font-mono text-[24px] leading-none font-semibold tabular">{tokenNumber(state)}</span>
        </div>
      </div>
      <dl className="px-4 py-1.5">
        {ROWS.map((row) => {
          const r = state.vitals[row.k]?.current;
          return (
            <div key={row.k} className="flex items-baseline gap-2 border-b border-dashed border-line py-2 last:border-b-0">
              <dt className="w-16 shrink-0 text-[12.5px] text-fg-2">{row.label}</dt>
              <dd className={cn("min-w-0 flex-1 font-mono text-[15px] tabular", r ? TONE[r.flag] : "text-fg-3")}>
                {r ? r.value : "—"}
                {r && <span className="ml-1 font-sans text-[11px] text-fg-3">{row.unit}</span>}
              </dd>
              {r && <span className="text-[11px] text-fg-3 tabular">{clockAt(state.arrivalMinuteOfDay, r.at)}</span>}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
