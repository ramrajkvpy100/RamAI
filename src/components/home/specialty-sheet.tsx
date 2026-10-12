"use client";

import { useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/ui/icon";
import { ALL_SPECIALTIES } from "@/engine/progression";
import { cn } from "@/lib/cn";
import { updateSettings } from "@/lib/engine-client";
import { primeMe, type Me } from "@/lib/me-store";
import { specialtyLabel, type PreferredSpecialty } from "@/lib/specialty";

/** Asked once, at the start (and changeable from the menu): the doctor's own specialty. Skipping it means mixed cases. */
export const SPECIALTY_EVENT = "ramai:specialty";

export function SpecialtySheet({ open, current, onClose }: { open: boolean; current: PreferredSpecialty | null; onClose: () => void }) {
  const [saving, setSaving] = useState<PreferredSpecialty | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Sheet
      open={open}
      onClose={() => (current === null ? void choose("mixed") : onClose())}
      title="What's your specialty?"
      description="Your cases will come from it. You can change it any time from the menu."
      placement="center"
      footer={
        <button type="button" onClick={() => void choose("mixed")} disabled={!!saving} className="h-10 w-full text-[13.5px] font-medium text-fg-2 hover:text-fg disabled:opacity-60">
          {current === null ? "Rather not say — give me mixed cases" : "Mixed cases — every specialty"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void choose("mixed")}
          disabled={!!saving}
          className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-60", current === "mixed" ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}
        >
          <span className="bg-ai flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
            <Icon name="sparkles" size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold">{specialtyLabel("mixed")}</span>
            <span className="block text-[12.5px] text-fg-2">Students, interns and anyone preparing for exams</span>
          </span>
        </button>
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
        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
