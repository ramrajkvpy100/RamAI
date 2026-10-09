import { cn } from "@/lib/cn";

export function Flame({ active = true, size = 18, className }: { active?: boolean; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={cn(active && "animate-flicker origin-bottom", className)}>
      <defs>
        <linearGradient id="flame-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={active ? "#fde047" : "#cbd5e1"} />
          <stop offset="0.55" stopColor={active ? "#f97316" : "#94a3b8"} />
          <stop offset="1" stopColor={active ? "#ef4444" : "#64748b"} />
        </linearGradient>
      </defs>
      <path d="M12 22a7 7 0 0 0 7-7c0-4.6-3.2-7.2-3.2-10.6-2.4 1.6-3.6 3.5-3.6 5.8-1.2-1-2.1-2.3-2.3-4.2C6.7 8.4 5 11.4 5 15a7 7 0 0 0 7 7z" fill="url(#flame-g)" />
      <path d="M12 21a3.5 3.5 0 0 0 3.5-3.5c0-2.2-1.6-3.5-1.6-5.2-1.6 1-2.4 2.3-2.5 3.6-.7-.5-1.1-1.2-1.3-2.1-1.1 1.2-1.6 2.4-1.6 3.7A3.5 3.5 0 0 0 12 21z" fill={active ? "#fff7d6" : "#e2e8f0"} opacity="0.85" />
    </svg>
  );
}

export function StreakPill({ days, className }: { days: number; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold tabular", days > 0 ? "bg-[color-mix(in_srgb,var(--flame)_14%,transparent)] text-flame" : "bg-surface-3 text-fg-3", className)} title={`${days}-day streak`}>
      <Flame active={days > 0} size={16} />
      {days}
    </span>
  );
}
