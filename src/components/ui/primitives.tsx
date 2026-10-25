import type { HTMLAttributes, ReactNode } from "react";

import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/format";

/** Small uppercase, letter-spaced section label. */
export function Label({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "h2" | "h3" | "span" | "dt" }) {
  return <As className={cn("micro text-fg-2", className)}>{children}</As>;
}

const DOT: Record<Tone, string> = {
  neutral: "bg-fg-3",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function StatusDot({ tone = "neutral", pulse = false, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone], pulse && "pulse-ring", className)} />;
}

const BADGE: Record<Tone, string> = {
  neutral: "bg-surface-3 text-fg-2",
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-5 items-center gap-1.5 rounded px-1.5 text-[11px] font-medium tabular", BADGE[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, tone = "accent", className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", DOT[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1 font-mono text-[10px] text-fg-2">{children}</kbd>;
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...rest} />;
}

export function Divider({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full bg-line-2", className)} />;
}

/**
 * The one "nothing here yet" layout for the whole app: an icon, what's missing, what to do — and, when there is one,
 * the button that does it. Same words, same look everywhere.
 */
export function EmptyState({ title, body, icon = "sparkles", action, compact = false, className }: { title: string; body: string; icon?: IconName; action?: { label: string; href?: string; onClick?: () => void }; compact?: boolean; className?: string }) {
  const btn = "mt-3 inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent transition-transform active:scale-[0.97]";
  return (
    <div role="status" className={cn("flex animate-enter flex-col items-center rounded-2xl border border-dashed border-line text-center", compact ? "px-4 py-5" : "px-6 py-10", className)}>
      <span aria-hidden className={cn("flex items-center justify-center rounded-2xl bg-accent-soft text-accent-text", compact ? "h-10 w-10" : "h-12 w-12")}>
        <Icon name={icon} size={compact ? 18 : 22} />
      </span>
      <p className={cn("font-semibold", compact ? "mt-2.5 text-[14px]" : "mt-4 text-[15px]")}>{title}</p>
      <p className="mt-1 max-w-sm text-[13.5px] leading-6 text-fg-2">{body}</p>
      {action && (action.href ? <Link href={action.href} className={btn}>{action.label}</Link> : <button type="button" onClick={action.onClick} className={btn}>{action.label}</button>)}
    </div>
  );
}
