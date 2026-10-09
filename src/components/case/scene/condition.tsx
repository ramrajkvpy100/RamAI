"use client";

import type { CaseState, PatientStatus } from "@/engine/types";
import { cn } from "@/lib/cn";
import { STATUS_LABEL } from "@/lib/format";

/** Higher is better. The bar and the trend only use statuses the player has seen. */
const LEVEL: Record<PatientStatus, number> = { deceased: 0, critical: 1, deteriorating: 2, guarded: 3, stable: 4, improving: 5, recovered: 6 };
const COLOR: Record<PatientStatus, string> = {
  deceased: "#94a3b8",
  critical: "#ef4444",
  deteriorating: "#f97316",
  guarded: "#f59e0b",
  stable: "#38bdf8",
  improving: "#10b981",
  recovered: "#059669",
};

export function historyOf(state: CaseState) {
  return state.statusHistory?.length ? state.statusHistory : [{ at: 0, status: state.patientStatus }];
}

export function trendOf(state: CaseState): "up" | "down" | "flat" {
  const h = historyOf(state);
  if (h.length < 2) return "flat";
  const now = LEVEL[h[h.length - 1]!.status];
  const before = LEVEL[h[h.length - 2]!.status];
  return now > before ? "up" : now < before ? "down" : "flat";
}

/** The patient's condition as a bar, a trend and a step chart since arrival. */
export function ConditionTrend({ state, className }: { state: CaseState; className?: string }) {
  const history = historyOf(state);
  const status = state.patientStatus;
  const trend = trendOf(state);
  const pct = (LEVEL[status] / 6) * 100;
  const end = Math.max(state.clock, history[history.length - 1]!.at + 1, 1);
  const W = 240;
  const H = 34;
  const x = (at: number) => (at / end) * W;
  const y = (s: PatientStatus) => H - 3 - (LEVEL[s] / 6) * (H - 6);
  let d = "";
  history.forEach((h, i) => {
    d += i === 0 ? `M0 ${y(h.status)}` : `H${x(h.at)}V${y(h.status)}`;
  });
  d += `H${W}`;

  return (
    <section aria-label={`Condition: ${STATUS_LABEL[status]}`} data-coach-target="condition" className={cn("rounded-2xl border border-line bg-surface px-3.5 py-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="micro text-fg-2">Condition</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            trend === "up" ? "bg-success-soft text-success" : trend === "down" ? "bg-danger-soft text-danger" : "bg-surface-3 text-fg-2",
          )}
        >
          {trend === "up" ? "↑ Better" : trend === "down" ? "↓ Worse" : "No change yet"}
        </span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-[linear-gradient(90deg,#ef4444,#f97316_30%,#f59e0b_48%,#38bdf8_68%,#10b981)]">
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-surface shadow-md transition-[left,background-color] duration-700 ease-out"
          style={{ left: `${Math.max(4, Math.min(96, pct))}%`, backgroundColor: COLOR[status] }}
          aria-hidden
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-fg-3">
        <span>Critical</span>
        <span className="font-medium" style={{ color: COLOR[status] }}>
          {STATUS_LABEL[status]}
        </span>
        <span>Recovered</span>
      </div>
      {history.length > 1 && (
        <figure className="mt-2.5">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[34px] w-full" preserveAspectRatio="none" aria-hidden>
            <path d={`M0 ${y("stable")}H${W}`} stroke="var(--line)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke={COLOR[status]} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {history.slice(1).map((h, i) => (
              <circle key={i} cx={x(h.at)} cy={y(h.status)} r="2.6" fill={COLOR[h.status]} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <figcaption className="mt-0.5 text-[10.5px] text-fg-3">Since arrival · {history.length - 1} change{history.length === 2 ? "" : "s"}</figcaption>
        </figure>
      )}
    </section>
  );
}
