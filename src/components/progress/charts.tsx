"use client";

import { cn } from "@/lib/cn";
import type { ProgressDetail } from "@/lib/progress-types";

const tone = (p: number) => (p >= 75 ? "var(--success)" : p >= 55 ? "var(--warning)" : "var(--danger)");

/** Scores over the last cases, with the pass line at 70. */
export function ScoreTrend({ trend }: { trend: ProgressDetail["trend"] }) {
  if (trend.length < 2) return <p className="text-[13.5px] text-fg-2">Your trend appears after a couple of cases.</p>;
  const W = 600;
  const H = 170;
  const pad = 10;
  const x = (i: number) => pad + (i / (trend.length - 1)) * (W - pad * 2);
  const y = (s: number) => H - pad - (s / 100) * (H - pad * 2);
  const line = trend.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(t.score).toFixed(1)}`).join(" ");
  const area = `${line} L${x(trend.length - 1)} ${H - pad} L${x(0)} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Scores of your last ${trend.length} cases, from ${trend[0]!.score} to ${trend.at(-1)!.score}`}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.5" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
      ))}
      <line x1={pad} x2={W - pad} y1={y(70)} y2={y(70)} stroke="var(--success)" strokeWidth="1.2" strokeDasharray="5 5" opacity="0.7" />
      <text x={pad + 2} y={y(70) - 6} fontSize="11" fill="var(--success)">
        70 · level cleared
      </text>
      <path d={area} fill="url(#trend-fill)" />
      <path d={line} fill="none" stroke="url(#trend-line)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {trend.map((t, i) => (
        <circle key={i} cx={x(i)} cy={y(t.score)} r={i === trend.length - 1 ? 5 : 3} fill={i === trend.length - 1 ? "#06b6d4" : "var(--surface)"} stroke="url(#trend-line)" strokeWidth="2">
          <title>{`${t.specialty}: ${t.score}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Each skill's average share of its marks, weakest first. */
export function SkillBars({ skills }: { skills: ProgressDetail["skills"] }) {
  if (!skills.length) return <p className="text-[13.5px] text-fg-2">Your skills profile appears after your next case.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {skills.map((s, i) => (
        <li key={s.id}>
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className={cn("font-medium", i === 0 && "text-danger")}>{s.label}</span>
            <span className="text-fg-2 tabular">{s.percent}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, s.percent)}%`, background: tone(s.percent) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Twelve weeks of practice, a square a day. */
export function ActivityGrid({ activity }: { activity: ProgressDetail["activity"] }) {
  const weeks: ProgressDetail["activity"][] = [];
  for (let i = 0; i < activity.length; i += 7) weeks.push(activity.slice(i, i + 7));
  const level = (n: number) => (n === 0 ? "bg-surface-3" : n === 1 ? "bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]" : n === 2 ? "bg-[color-mix(in_srgb,var(--accent)_65%,transparent)]" : "bg-accent");
  const days = activity.filter((d) => d.cases > 0).length;
  return (
    <div>
      <div className="flex gap-[5px]" role="img" aria-label={`You practised on ${days} of the last 84 days`}>
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-1 flex-col gap-[5px]">
            {week.map((d) => (
              <span key={d.day} title={`${d.day}: ${d.cases} case${d.cases === 1 ? "" : "s"}`} className={cn("aspect-square w-full rounded-[4px]", level(d.cases))} />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12.5px] text-fg-2">
        {days} of the last 84 days · {activity.reduce((n, d) => n + d.cases, 0)} cases
      </p>
    </div>
  );
}
