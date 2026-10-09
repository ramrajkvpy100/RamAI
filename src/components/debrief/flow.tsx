import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/** Renders "a → b → c" as a quiet causal chain. */
export function Chain({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\s*→\s*/).filter(Boolean);
  if (parts.length < 2) return <p className={cn("text-[14px] leading-6", className)}>{text}</p>;
  return (
    <ol className={cn("flex flex-col gap-1", className)}>
      {parts.map((p, i) => (
        <li key={i} className="flex items-start gap-2 text-[14px] leading-6">
          <span className="mt-[5px] flex w-4 shrink-0 justify-center text-fg-3">
            {i === 0 ? <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-fg-3" /> : <Icon name="arrow-right" size={13} className="rotate-90 sm:rotate-0" />}
          </span>
          <span>{p}</span>
        </li>
      ))}
    </ol>
  );
}

/** A vertical step sequence with connectors — routines, rescue sequences, escalation. */
export function Steps({ steps, tone = "neutral", numbered = true }: { steps: string[]; tone?: "neutral" | "accent" | "danger"; numbered?: boolean }) {
  const dot = tone === "accent" ? "border-accent-line bg-accent-soft text-accent-text" : tone === "danger" ? "border-[color-mix(in_srgb,var(--danger)_30%,var(--line))] bg-danger-soft text-danger" : "border-line bg-surface-2 text-fg-2";
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-line-2" />}
          <span className={cn("relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10.5px] font-medium tabular", dot)}>
            {numbered ? i + 1 : <span className="h-1 w-1 rounded-full bg-current" />}
          </span>
          <span className="pt-px text-[14px] leading-6">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function Bullets({ items, className, marker = "dot" }: { items: string[]; className?: string; marker?: "dot" | "check" | "alert" }) {
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[14px] leading-6">
          {marker === "check" ? (
            <Icon name="check" size={14} className="mt-[5px] shrink-0 text-success" />
          ) : marker === "alert" ? (
            <Icon name="alert" size={14} className="mt-[5px] shrink-0 text-danger" />
          ) : (
            <span className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-fg-3" />
          )}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
