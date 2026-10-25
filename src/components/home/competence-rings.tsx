"use client";

import Link from "next/link";

import { ratingTier, RATING_TIERS } from "@/engine/progression";
import { cn } from "@/lib/cn";
import type { Me } from "@/lib/me-store";

/**
 * Your clinical rating — one number, like a chess rating: it rises with good scores on harder cases and falls with
 * poor ones on easy cases (cases finished with the senior's help don't count). Below it: today, three dots to fill.
 */
export function CompetenceRings({ me }: { me: Me }) {
  const p = me.progress;
  const rating = p.rating ?? 1200;
  const tier = ratingTier(rating);
  const next = RATING_TIERS.find((t) => t.from > rating);
  const prevFrom = tier.from;
  const toNext = next ? (rating - prevFrom) / (next.from - prevFrom) : 1;
  const change = p.ratingChange ?? 0;
  const today = Math.min(3, me.rings?.cases ?? 0);
  return (
    <Link href="/progress" className="panel flex animate-rise items-center gap-4 p-4 [animation-delay:80ms] sm:p-5" aria-label={`Clinical rating ${rating}, ${tier.label}`}>
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-400 text-white shadow-md">
        <span className="text-[20px] leading-none font-bold tabular">{rating}</span>
        <span className="mt-0.5 text-[9.5px] font-semibold tracking-[0.12em] uppercase opacity-85">rating</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] font-semibold">{tier.label}</span>
          {change !== 0 && <span className={cn("text-[12.5px] font-semibold tabular", change > 0 ? "text-success" : "text-danger")}>{change > 0 ? `▲ ${change}` : `▼ ${-change}`}</span>}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-[width] duration-700" style={{ width: `${Math.max(4, toNext * 100)}%` }} />
        </div>
        <p className="mt-1 text-[12px] text-fg-2">{next ? `${next.from - rating} to ${next.label}` : "Top tier"}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-fg-2">
          Today
          {[0, 1, 2].map((i) => <span key={i} className={cn("h-2.5 w-2.5 rounded-full transition-colors", i < today ? "bg-success" : "bg-surface-3")} />)}
          <span className="tabular">{today}/3 cases</span>
          {(p.freezesLeft ?? 2) > 0 && <span className="ml-auto" title="Missed days forgiven automatically this month">🧊 {p.freezesLeft ?? 2}</span>}
        </p>
      </div>
    </Link>
  );
}
