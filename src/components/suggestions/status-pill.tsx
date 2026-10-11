import { cn } from "@/lib/cn";
import { STATUS_LABEL, type SuggestionStatus } from "@/lib/suggestions-client";

const TONE: Record<SuggestionStatus, string> = {
  new: "bg-accent-soft text-accent-text",
  reviewing: "bg-warning-soft text-warning",
  planned: "bg-[color-mix(in_srgb,var(--violet)_14%,transparent)] text-violet",
  done: "bg-success-soft text-success",
  declined: "bg-surface-3 text-fg-2",
};

export function StatusPill({ status, className }: { status: SuggestionStatus; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap", TONE[status], className)}>{STATUS_LABEL[status]}</span>;
}

export const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
