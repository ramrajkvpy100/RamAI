"use client";

import { useState } from "react";

import { RadiologyReporting } from "@/components/radiology/radiology-reporting";
import { cn } from "@/lib/cn";
import type { PracticeStats } from "@/server/practice";
import { algorithmQuestions, antidoteQuestions, calculationQuestions } from "@/lib/skills";

import { PracticeDrill } from "./practice-drill";
import { QuizDrill } from "./quiz-drill";

type Section = "spot" | "radiology" | "antidotes" | "algorithms" | "calculations";

const SECTIONS: [Section, string, string][] = [
  ["spot", "🔍 Spot the diagnosis", "ECG, X-ray, CT, ultrasound, blood smear"],
  ["radiology", "🩻 Radiology reporting", "History to diagnosis — scroll real CT and MRI"],
  ["antidotes", "💊 Antidotes", "Poisoning and the right antidote"],
  ["algorithms", "🚨 Emergency algorithms", "ACLS, anaphylaxis, DKA, status, PPH…"],
  ["calculations", "🧮 Clinical calculations", "GCS, CURB-65, anion gap, CrCl, fluids…"],
];

/** Skills Lab: every drill in one place — pick one. */
export function SkillsLab({ stats }: { stats: PracticeStats[] }) {
  const [section, setSection] = useState<Section>("spot");
  return (
    <div className="flex flex-col gap-5 py-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Skills Lab</h1>
        <p className="mt-1 text-[14.5px] text-fg-2">Short drills for every doctor. Pick one.</p>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {SECTIONS.map(([id, label, sub]) => (
          <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)} className={cn("flex min-h-[76px] flex-col justify-center rounded-2xl border px-3 py-2.5 text-left transition-colors", section === id ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:bg-surface-2")}>
            <span className="text-[14px] font-semibold">{label}</span>
            <span className="mt-0.5 text-[11.5px] leading-4 text-fg-2">{sub}</span>
          </button>
        ))}
      </div>
      {section === "spot" && <PracticeDrill stats={stats} />}
      {section === "radiology" && <RadiologyReporting embedded />}
      {section === "antidotes" && <QuizDrill make={antidoteQuestions} title="Antidotes" />}
      {section === "algorithms" && <QuizDrill make={algorithmQuestions} title="Emergency algorithms" />}
      {section === "calculations" && <QuizDrill make={calculationQuestions} title="Clinical calculations" />}
    </div>
  );
}
