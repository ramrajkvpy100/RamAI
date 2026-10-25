import { cn } from "@/lib/cn";

/** Mastered of total — the bar every Skills Lab section and subcategory shows. */
export function SkillBar({ mastered, total, className }: { mastered: number; total: number; className?: string }) {
  const pct = total ? Math.min(100, Math.round((mastered / total) * 100)) : 0;
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <span className="block h-full rounded-full bg-success transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 text-[11.5px] text-fg-3 tabular">{Math.min(mastered, total)}/{total}</span>
    </span>
  );
}
