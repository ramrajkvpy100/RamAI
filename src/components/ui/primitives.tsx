import type { HTMLAttributes, ReactNode } from "react";

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

export function EmptyState({ title, body, className }: { title: string; body: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-line px-4 py-5", className)}>
      <Label>{title}</Label>
      <p className="text-ui text-fg-2">{body}</p>
    </div>
  );
}
