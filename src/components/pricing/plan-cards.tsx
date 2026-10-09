"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { PLANS, PRICES, type BillingPeriod } from "@/lib/plans";

function Feature({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-6">
      <span className={cn("mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full", dark ? "bg-white/12 text-cyan-300" : "bg-success-soft text-success")}>
        <Icon name="check" size={12} strokeWidth={2.4} />
      </span>
      <span className={dark ? "text-white/85" : "text-fg-2"}>{children}</span>
    </li>
  );
}

export function PeriodToggle({ value, onChange }: { value: BillingPeriod; onChange: (p: BillingPeriod) => void }) {
  return (
    <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-line bg-surface p-1 shadow-sm">
      {(["monthly", "yearly"] as const).map((p) => (
        <button
          key={p}
          role="radio"
          aria-checked={value === p}
          type="button"
          onClick={() => onChange(p)}
          className={cn("flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors", value === p ? "bg-fg text-bg" : "text-fg-2 hover:text-fg")}
        >
          {p === "monthly" ? "Monthly" : "Yearly"}
          {p === "yearly" && <span className={cn("rounded-full px-1.5 text-[10.5px] font-semibold", value === p ? "bg-bg/20" : "bg-success-soft text-success")}>−30%</span>}
        </button>
      ))}
    </div>
  );
}

/** Free and Pro side by side. Calls to action are supplied by the page. */
export function PlanCards({ period, free, pro }: { period: BillingPeriod; free: ReactNode; pro: ReactNode }) {
  const price = PRICES[period];
  const perMonth = period === "yearly" ? Math.round(PRICES.yearly.amount / 12) : null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel flex flex-col p-7">
        <div className="text-[15px] font-semibold">Free</div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-[40px] leading-none font-semibold tracking-[-0.03em]">₹0</span>
          <span className="text-[14px] text-fg-2">forever</span>
        </div>
        <p className="mt-3 text-[13.5px] text-fg-2">Build the habit. A few real cases every day.</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {PLANS.free.features.map((f) => (
            <Feature key={f}>{f}</Feature>
          ))}
        </ul>
        <div className="mt-auto pt-8">{free}</div>
      </div>

      <div className="ink relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] p-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgb(124_58_237/0.45),transparent_65%)] blur-2xl" />
        <div className="relative flex items-center gap-2 text-[15px] font-semibold">
          RamAI Pro <Icon name="crown" size={15} className="text-amber-300" />
        </div>
        <div className="relative mt-3 flex items-baseline gap-1.5">
          <span className="text-[40px] leading-none font-semibold tracking-[-0.03em]">{price.label}</span>
          <span className="text-[14px] text-white/60">/ {price.per}</span>
        </div>
        <p className="relative mt-3 text-[13.5px] text-white/65">{perMonth ? `₹${perMonth} a month, billed yearly.` : "Every level, unlimited cases."}</p>
        <ul className="relative mt-6 flex flex-col gap-2.5">
          {PLANS.pro.features.map((f) => (
            <Feature key={f} dark>
              {f}
            </Feature>
          ))}
        </ul>
        <div className="relative mt-auto pt-8">{pro}</div>
      </div>
    </div>
  );
}
