"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RadiologyReporting } from "@/components/radiology/radiology-reporting";
import { SlidingPill } from "@/components/ui/motion-primitives";
import { cn } from "@/lib/cn";
import { MODALITY_IDS, type Modality } from "@/lib/practice";
import { useSkillProgress } from "@/lib/skill-progress";
import type { PracticeStats } from "@/server/practice";
import { ALGORITHM_IDS, CALC_IDS, ANTIDOTE_IDS, algorithmQuestions, antidoteQuestions, calculationQuestions, type SkillLevel } from "@/lib/skills";

import { LessonButton } from "./lesson";
import { PracticeDrill } from "./practice-drill";
import { QuizDrill } from "./quiz-drill";
import { SoundsDrill } from "./sounds-drill";

export type Section = "spot" | "radiology" | "sounds" | "antidotes" | "algorithms" | "calculations";

const MODALITY_FIRST: Record<string, Modality[]> = {
  Cardiology: ["ecg"], Respiratory: ["xray"], Neurology: ["ct"], Surgery: ["xray", "ct"], Emergency: ["ecg", "xray"],
  OBGYN: ["usg"], Gastroenterology: ["usg", "ct"], Urology: ["usg", "ct"], Orthopedics: ["xray"], "Infectious Disease": ["smear"],
};

/** One drill, opened from the Skills Lab: loaded only then, because the question banks are large. */
export function SkillSection({ section, title, level, specialty, onBack }: { section: Section; title: string; level: SkillLevel; specialty: string | null; onBack: () => void }) {
  // (Read after the page is drawn: the drills don't wait for them.)
  const [stats, setStats] = useState<PracticeStats[]>([]);
  useEffect(() => {
    fetch("/api/practice/stats", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setStats(d.stats)).catch(() => undefined);
  }, []);
  const modalities = useMemo(() => {
    const first = specialty ? MODALITY_FIRST[specialty] ?? [] : [];
    return [...first, ...MODALITY_IDS.filter((m) => !first.includes(m))];
  }, [specialty]);
  const progress = useSkillProgress();
  const [cat, setCat] = useState<string | null>(null);
  const antidotes = useCallback(() => antidoteQuestions(level, specialty, cat ?? undefined), [level, specialty, cat]);
  const algorithms = useCallback(() => algorithmQuestions(level, specialty, cat ?? undefined), [level, specialty, cat]);
  const calculations = useCallback(() => calculationQuestions(level, specialty, cat ?? undefined), [level, specialty, cat]);

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="h-9 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-medium hover:bg-surface-2">
          ← Skills Lab
        </button>
        <h1 className="min-w-0 flex-1 text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
        <LessonButton key={section} ids={section === "spot" ? ["ecg", "xray", "ct", "usg", "smear", "clinical"] : [section]} />
      </header>
      {section === "spot" && <PracticeDrill stats={stats} level={level} order={modalities} />}
      {section === "radiology" && <RadiologyReporting embedded />}
      {section === "sounds" && <SoundsDrill level={level} />}
      {(section === "antidotes" || section === "algorithms" || section === "calculations") && (
        <div role="radiogroup" aria-label="Subcategory" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...[...new Set((section === "antidotes" ? ANTIDOTE_IDS() : section === "algorithms" ? ALGORITHM_IDS() : CALC_IDS()).map((x) => x.cat))]].map((c) => {
            const ids = (section === "antidotes" ? ANTIDOTE_IDS() : section === "algorithms" ? ALGORITHM_IDS() : CALC_IDS()).filter((x) => !c || x.cat === c).map((x) => x.id);
            return (
              <button key={c ?? "all"} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)} className={cn("relative isolate shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors", cat === c ? "border-accent-line text-accent-text" : "border-line text-fg-2 hover:text-fg")}>
                {cat === c && <SlidingPill id="skills-chip" className="rounded-full bg-accent-soft" />}
                {c ?? "All"} <span className="text-fg-3 tabular">{progress("quiz:", ids).mastered}/{ids.length}</span>
              </button>
            );
          })}
        </div>
      )}
      {section === "antidotes" && <QuizDrill key={`a-${cat}`} make={antidotes} title="Antidotes" />}
      {section === "algorithms" && <QuizDrill key={`g-${cat}`} make={algorithms} title="Emergency algorithms" />}
      {section === "calculations" && <QuizDrill key={`c-${cat}`} make={calculations} title="Clinical calculations" />}
    </div>
  );
}
