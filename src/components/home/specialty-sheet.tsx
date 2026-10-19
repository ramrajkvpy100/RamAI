"use client";

import { useEffect, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { ALL_SPECIALTIES } from "@/engine/progression";
import { setCareerStage, useCareerStage, type CareerStage } from "@/lib/career-stage";
import { cn } from "@/lib/cn";
import { updateSettings } from "@/lib/engine-client";
import { primeMe, type Me } from "@/lib/me-store";
import { specialtyLabel, type PreferredSpecialty } from "@/lib/specialty";

/** Asked once, at the start (and changeable from the menu): the doctor's own specialty. Skipping it means mixed cases. */
export const SPECIALTY_EVENT = "ramai:specialty";

const STAGE_LABELS: [CareerStage, string, string][] = [
  ["student", "🎓 Student", "Mixed cases"],
  ["intern", "🩺 Intern", "Mixed cases"],
  ["resident", "🏥 Resident", "Pick your specialty"],
  ["specialist", "⭐ Specialist", "Pick your specialty"],
  ["radiologist", "🩻 Radiologist", "Radiology reporting"],
];

export function SpecialtySheet({ open, current, onClose }: { open: boolean; current: PreferredSpecialty | null; onClose: () => void }) {
  const [saving, setSaving] = useState<PreferredSpecialty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stage = useCareerStage();
  // Step two — the specialty — only for residents and specialists; everyone else gets mixed cases.
  const [step, setStep] = useState<"stage" | "specialty">("stage");
  useEffect(() => {
    if (open) setStep("stage");
  }, [open]);

  const choose = async (specialty: PreferredSpecialty) => {
    if (saving) return;
    setSaving(specialty);
    setError(null);
    try {
      const me = (await updateSettings({ specialty })) as Me;
      if (me?.user) primeMe(me);
      onClose();
    } catch {
      setError("That didn't save. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  const pickStage = async (id: CareerStage) => {
    setCareerStage(id);
    if (id === "resident" || id === "specialist") setStep("specialty");
    else {
      await choose("mixed");
      if (id === "radiologist") window.location.href = "/practice?drill=radiology";
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => (current === null ? void choose("mixed") : onClose())}
      title={step === "stage" ? "Where are you in your career?" : "What's your specialty?"}
      description={step === "stage" ? "Cases and drills will match your level. You can change it any time from the menu." : "Your cases will come from it."}
      placement="center"
      footer={
        step === "specialty" ? (
          <button type="button" onClick={() => setStep("stage")} className="h-10 w-full text-[13.5px] font-medium text-fg-2 hover:text-fg">
            ← Back
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2">
        {step === "stage" ? (
          STAGE_LABELS.map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              disabled={!!saving}
              onClick={() => void pickStage(id)}
              className={cn("flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-60", stage === id ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}
            >
              <span className="text-[15px] font-semibold">{label}</span>
              <span className="text-[12.5px] text-fg-2">{saving && stage === id ? "Saving…" : hint}</span>
            </button>
          ))
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_SPECIALTIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void choose(s)}
                disabled={!!saving}
                className={cn("min-h-11 rounded-xl border px-3 py-2 text-left text-[13.5px] font-medium transition-colors disabled:opacity-60", current === s ? "border-accent-line bg-accent-soft text-accent-text" : "border-line bg-surface hover:bg-surface-2")}
              >
                {saving === s ? "Saving…" : specialtyLabel(s)}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
