"use client";

import { useState, type CSSProperties } from "react";

import { LangToggle } from "@/components/case/lang-toggle";
import { LEVEL_STYLE, levelGradient, TRACK_ICON } from "@/components/game/level-style";
import { FillingBar } from "@/components/ui/filling-bar";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { levelMeta, trackLabel } from "@/engine/levels";
import { ALL_SPECIALTIES } from "@/engine/progression";
import { CARE_LEVELS, CASE_TRACKS, type CareLevel, type CaseTrack, type Specialty } from "@/engine/types";
import { cn } from "@/lib/cn";
import type { CaseChoice, LibraryInfo } from "@/lib/engine-client";
import { caseLabel } from "@/lib/format";
import { useMe } from "@/lib/me-store";
import { useStartingMessage } from "@/lib/use-starting-message";
import type { Plan } from "@/lib/plans";

/** Conditions doctors see every week — one tap to practise. */
const COMMON_DISEASES = ["Dengue fever", "Typhoid", "Malaria", "Community-acquired pneumonia", "Acute gastroenteritis", "Urinary tract infection", "Type 2 diabetes", "Hypertension", "Asthma exacerbation", "COPD exacerbation", "Acute coronary syndrome", "Heart failure", "Stroke", "Snakebite", "Organophosphate poisoning", "Appendicitis", "Tuberculosis", "Anaemia", "Hypothyroidism", "Pre-eclampsia"];

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
  const country = useMe()?.user.country ?? "IN";
  const startingLabel = useStartingMessage(starting);
  const [track, setTrack] = useState<CaseTrack | undefined>();
  const [level, setLevel] = useState<CareLevel | undefined>();
  const [unlimited, setUnlimited] = useState(false);
  const [disease, setDisease] = useState("");
  // Starts at the doctor's own specialty; "Any specialty" means every one this time.
  const own = useMe()?.user.specialty;
  const [specialty, setSpecialty] = useState<Specialty | undefined>(own && own !== "mixed" ? own : undefined);
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
          <button type="button" onClick={() => onStart({ track, level, specialty: specialty ?? "any", ...(unlimited ? { unlimited: true } : {}), ...(disease.trim().length >= 2 ? { disease: disease.trim() } : {}) })} disabled={starting} className="shine relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full text-[15px] font-semibold text-white shadow-glow disabled:opacity-80">
            {starting ? startingLabel : "Start case"}
            {!starting && <Icon name="arrow-right" size={16} />}
            {/* How far along the new patient is: a bar filling along the bottom of the button. */}
            {starting && <FillingBar active expectedMs={35_000} tone="light" label="Preparing your patient" className="absolute inset-x-5 bottom-1.5 w-auto" />}
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
                  {t ? (t === "phone" ? "Phone" : trackLabel(t, country)) : "Any"}
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
                    <span className="block text-[13.5px] leading-tight font-semibold">{levelMeta(l, country).short}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-fg-2">{locked ? "Pro" : none ? "Coming soon" : levelMeta(l, country).tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Practise a disease (optional)">
          <input
            value={disease}
            onChange={(e) => setDisease(e.target.value.slice(0, 80))}
            placeholder="Any — or type one, e.g. Dengue fever"
            className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-accent-line"
            aria-label="Disease to practise"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COMMON_DISEASES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={disease === d}
                onClick={() => setDisease(disease === d ? "" : d)}
                className={cn("rounded-full border px-3 py-1 text-[12.5px] transition-colors", disease === d ? "border-accent-line bg-accent-soft text-fg" : "border-line bg-surface text-fg-2 hover:bg-surface-2")}
              >
                {d}
              </button>
            ))}
          </div>
        </Group>

        <Group label="Play with someone (optional)">
          <div className="grid grid-cols-3 gap-2">
            {([
              ["invite", "👥", "Invite a friend"],
              ["find", "🔎", "Find an opponent"],
              ["computer", "🤖", "Play the computer"],
            ] as const).map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                disabled={starting}
                onClick={() => onStart({ track, level, specialty: specialty ?? "any", duel: id, ...(unlimited ? { unlimited: true } : {}), ...(disease.trim().length >= 2 ? { disease: disease.trim() } : {}) })}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 py-2 text-center text-[12.5px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-60"
              >
                <span className="text-[20px]" aria-hidden>{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-fg-3">Same patient, two doctors — the higher score wins.</p>
        </Group>

        <Group label="Resources">
          <button
            type="button"
            aria-pressed={unlimited}
            onClick={() => setUnlimited((u) => !u)}
            className={cn("flex min-h-[56px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors", unlimited ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}
          >
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[12px]", unlimited ? "border-accent bg-accent text-white" : "border-line")}>{unlimited ? "✓" : ""}</span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold">All resources 🏥</span>
              <span className="block text-[11.5px] text-fg-2">Order any test, do anything — whatever the level. Patients reply with emojis.</span>
            </span>
          </button>
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
