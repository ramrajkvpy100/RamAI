import { useId } from "react";

import { league } from "@/lib/leagues";
import { cn } from "@/lib/cn";

/** A league crest: a metal shield with a pulse line. Greyed out when `locked`. */
export function LeagueBadge({ tier, size = 48, locked = false, className }: { tier: number; size?: number; locked?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const l = league(tier);
  const from = locked ? "#e5e7eb" : l.from;
  const to = locked ? "#9ca3af" : l.to;
  return (
    <svg viewBox="0 0 64 72" width={size} height={(size * 72) / 64} className={cn("shrink-0", className)} role="img" aria-label={`${l.label} League`}>
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M32 3 58 13v21c0 17-11 29-26 35C17 63 6 51 6 34V13Z" fill={`url(#${id}-metal)`} />
      <path d="M32 3 58 13v21c0 17-11 29-26 35C17 63 6 51 6 34V13Z" fill="none" stroke={to} strokeOpacity="0.55" strokeWidth="1.5" />
      <path d="M32 10 52 17.5v16c0 13-8.4 22.5-20 27.4C20.4 56 12 46.5 12 33.5v-16Z" fill="#ffffff" fillOpacity={locked ? 0.35 : 0.22} />
      <path d="M32 3 58 13v21c0 17-11 29-26 35C17 63 6 51 6 34V13Z" fill={`url(#${id}-shine)`} />
      <path d="M16 37h8l3.5-8 5 16 4-11 2.5 3H48" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity={locked ? 0.75 : 1} />
      {tier >= 3 && !locked && (
        <g fill="#ffffff">
          {Array.from({ length: tier - 2 }, (_, i) => (
            <circle key={i} cx={32 + (i - (tier - 3) / 2) * 6} cy="20" r="1.8" />
          ))}
        </g>
      )}
    </svg>
  );
}
