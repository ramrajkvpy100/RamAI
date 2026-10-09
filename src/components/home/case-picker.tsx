"use client";

import { useState, type CSSProperties } from "react";

import { LangToggle } from "@/components/case/lang-toggle";
import { LEVEL_STYLE, levelGradient, TRACK_ICON } from "@/components/game/level-style";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { LEVELS, TRACKS } from "@/engine/levels";
import { ALL_SPECIALTIES } from "@/engine/progression";
import { CARE_LEVELS, CASE_TRACKS, type CareLevel, type CaseTrack, type Specialty } from "@/engine/types";
import { cn } from "@/lib/cn";
import type { CaseChoice, LibraryInfo } from "@/lib/engine-client";
import { caseLabel } from "@/lib/format";
import type { Plan } from "@/lib/plans";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="micro mb-2.5 text-fg-2">{label}</legend>
      {children}
    </fieldset>
  );
}

/** One sheet: mode, level, specialty. Everything defaults to "Any". */
export function CasePicker({
  open,
  onClose,
  onStart,
  onLocked,
  library,
  plan,
  starting,
  activeCase,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (choice: CaseChoice) => void;
  onLocked: (level: CareLevel) => void;
  library: LibraryInfo;
  plan: Plan;
  starting: boolean;
  activeCase?: number;
}) {
  const [track, setTrack] = useState<CaseTrack | undefined>();
  const [level, setLevel] = useState<CareLevel | undefined>();
  const [specialty, setSpecialty] = useState<Specialty | undefined>();
  const specialties = ALL_SPECIALTIES.filter((s) => (library.specialties[s] ?? 0) > 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Choose a case"
      placement="responsive"
      footer={
        <div className="flex flex-col gap-2">
          {activeCase !== undefined && <p className="text-center text-[12px] text-fg-3">Starting a new case ends {caseLabel(activeCase)}.</p>}
          <button type="button" onClick={() => onStart({ track, level, specialty })} disabled={starting} className="shine flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white shadow-glow disabled:opacity-60">
            {starting ? "Preparing case…" : "Start case"}
            {!starting && <Icon name="arrow-right" size={16} />}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Group label="Mode">
          <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-surface-3 p-1">
            {[undefined, ...CASE_TRACKS].map((t) => {
              const none = t !== undefined && !(library.tracks[t] ?? 0);
              return (
                <button
                  key={t ?? "any"}
                  type="button"
                  disabled={none}
                  aria-pressed={track === t}
                  onClick={() => setTrack(t)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-35",
                    track === t ? "bg-surface text-fg shadow-sm" : "text-fg-2 hover:text-fg",
                  )}
                >
                  {t && <Icon name={TRACK_ICON[t]} size={14} className="hidden sm:block" />}
                  {t ? (t === "phone" ? "Phone" : TRACKS[t].label) : "Any"}
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Level">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              aria-pressed={level === undefined}
              onClick={() => setLevel(undefined)}
              className={cn("flex min-h-[64px] flex-col justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors", level === undefined ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}
            >
              <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                <Icon name="shuffle" size={15} className="text-fg-2" /> Any level
              </span>
              <span className="mt-0.5 text-[11.5px] text-fg-2">Within your plan</span>
            </button>
            {CARE_LEVELS.map((l) => {
              const locked = !plan.levels.includes(l);
              const none = !(library.levels[l] ?? 0);
              return (
                <button
                  key={l}
                  type="button"
                  disabled={none && !locked}
                  aria-pressed={level === l}
                  onClick={() => (locked ? onLocked(l) : setLevel(l))}
                  className={cn(
                    "relative flex min-h-[64px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40",
                    level === l ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:bg-surface-2",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: locked ? "var(--fg-3)" : levelGradient(l), "--press": LEVEL_STYLE[l].press } as CSSProperties}>
                    <Icon name={locked ? "lock" : LEVEL_STYLE[l].icon} size={15} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] leading-tight font-semibold">{LEVELS[l].short}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-fg-2">{locked ? "Pro" : none ? "Coming soon" : LEVELS[l].tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Patients and families speak">
          <LangToggle className="self-start" />
        </Group>

        <Group label="Specialty">
          <div className="relative">
            <select
              value={specialty ?? ""}
              onChange={(e) => setSpecialty((e.target.value || undefined) as Specialty | undefined)}
              className="h-11 w-full appearance-none rounded-xl border border-line bg-surface pr-10 pl-3.5 text-[14.5px] outline-none focus:border-accent-line focus:shadow-[0_0_0_3px_var(--accent-soft)]"
              aria-label="Specialty"
            >
              <option value="">Any specialty</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" size={15} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-fg-3" />
          </div>
        </Group>
      </div>
    </Sheet>
  );
}
