"use client";

import { Badge } from "@/components/ui/primitives";
import type { CaseScore } from "@/engine/types";
import { cn } from "@/lib/cn";
import { useCountUp } from "@/lib/use-count-up";

export function ScoreRing({ score, size = 128 }: { score: number; size?: number }) {
  const value = useCountUp(score, 1200, 250);
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? "var(--success)" : score >= 50 ? "var(--accent)" : score >= 35 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[38px] leading-none font-medium tracking-[-0.03em] tabular" aria-label={`Score ${score} out of 100`}>
          {Math.round(value)}
        </span>
        <span className="mt-1 text-[11px] text-fg-3 tabular">/ 100</span>
      </div>
    </div>
  );
}

export function ScoreBreakdown({ score }: { score: CaseScore }) {
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {score.lines.map((l) => {
          const pct = l.max ? l.earned / l.max : 0;
          return (
            <li key={l.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
              <span className="text-[13.5px]">{l.label}</span>
              <span className="text-[12.5px] text-fg-2 tabular">
                <span className="text-fg">{Number.isInteger(l.earned) ? l.earned : l.earned.toFixed(1)}</span> / {l.max}
              </span>
              <div className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-1000 ease-out", pct >= 0.75 ? "bg-success" : pct >= 0.5 ? "bg-accent" : pct >= 0.3 ? "bg-warning" : "bg-danger")}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              {l.notes.length > 0 && <p className="col-span-2 text-[12px] leading-5 text-fg-2">{l.notes.join(" · ")}</p>}
            </li>
          );
        })}
      </ul>
      {(score.penalties.length > 0 || score.bonuses.length > 0) && (
        <div className="flex flex-col gap-2 border-t border-line-2 pt-4">
          {score.bonuses.map((b) => (
            <div key={b.label} className="flex items-start gap-2.5 text-[12.5px]">
              <Badge tone="success">Bonus</Badge>
              <span>
                <span className="font-medium">{b.label}</span> <span className="text-fg-2">— {b.reason}</span>
              </span>
            </div>
          ))}
          {score.penalties.map((p) => (
            <div key={p.label + p.reason} className="flex items-start gap-2.5 text-[12.5px]">
              <Badge tone="danger">Penalty</Badge>
              <span>
                <span className="font-medium">{p.label}</span> <span className="text-fg-2">— {p.reason}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
