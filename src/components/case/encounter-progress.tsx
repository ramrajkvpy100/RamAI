import { ENCOUNTER_STAGES, type EncounterStage } from "@/engine/types";
import { cn } from "@/lib/cn";

const LABEL: Record<EncounterStage, string> = {
  history: "History",
  examination: "Examination",
  investigation: "Investigation",
  diagnosis: "Diagnosis",
  treatment: "Treatment",
  followup: "Follow-up",
};

/** Informational only — the encounter is never a wizard. */
export function EncounterProgress({ stage, touched, className }: { stage: EncounterStage; touched: EncounterStage[]; className?: string }) {
  return (
    <nav aria-label="Encounter progress (informational)" className={cn("overflow-x-auto [scrollbar-width:none]", className)}>
      <ol className="flex min-w-max items-center gap-4">
        {ENCOUNTER_STAGES.map((s) => {
          const current = s === stage && touched.length > 0;
          const done = touched.includes(s);
          return (
            <li key={s} className="flex items-center gap-1.5" aria-current={current ? "step" : undefined}>
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full border",
                  current ? "border-accent bg-accent" : done ? "border-fg-3 bg-fg-3" : "border-fg-3 bg-transparent",
                )}
              />
              <span className={cn("text-[11.5px] tracking-[0.01em]", current ? "text-fg" : done ? "text-fg-2" : "text-fg-3")}>{LABEL[s]}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
