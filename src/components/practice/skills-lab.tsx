"use client";

import { LessonButton } from "./lesson";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RadiologyReporting } from "@/components/radiology/radiology-reporting";
import { useCareerStage } from "@/lib/career-stage";
import { useMe } from "@/lib/me-store";
import { MODALITIES, MODALITY_IDS, type Modality } from "@/lib/practice";
import { useSkillProgress } from "@/lib/skill-progress";
import type { PracticeStats } from "@/server/practice";
import { ALGORITHM_COUNT, ALGORITHM_IDS, CALC_IDS, ANTIDOTE_COUNT, ANTIDOTE_IDS, CALCULATION_COUNT, algorithmQuestions, antidoteQuestions, calculationQuestions, type SkillLevel } from "@/lib/skills";

import { PracticeDrill } from "./practice-drill";
import { QuizDrill } from "./quiz-drill";
import { SkillBar } from "./progress-bar";
import { HEART_CASES, LUNG_CASES, SoundsDrill } from "./sounds-drill";

type Section = "spot" | "radiology" | "sounds" | "antidotes" | "algorithms" | "calculations";

const SECTIONS: Record<Section, [string, string]> = {
  spot: ["🔍 Spot the diagnosis", "Clinical images, ECG, X-ray, CT, ultrasound, blood smear"],
  radiology: ["🩻 Radiology reporting", "History to diagnosis on real scans"],
  sounds: ["🩺 Heart & breath sounds", "Listen and name it"],
  antidotes: ["💊 Antidotes", "Poisoning and the right antidote"],
  algorithms: ["🚨 Emergency algorithms", "What comes next?"],
  calculations: ["🧮 Clinical calculations", "Quick bedside sums"],
};

/** A doctor's own specialty's drills come first. */
const FIRST: Record<string, Section[]> = {
  Cardiology: ["sounds", "spot", "algorithms"],
  Respiratory: ["sounds", "spot"],
  Emergency: ["algorithms", "antidotes", "calculations"],
  Medicine: ["spot", "algorithms", "antidotes"],
  Pediatrics: ["calculations", "sounds"],
  Nephrology: ["calculations", "algorithms"],
  Endocrinology: ["calculations", "algorithms"],
  Neurology: ["spot", "algorithms"],
  Surgery: ["spot", "algorithms"],
  OBGYN: ["algorithms", "spot"],
};
const MODALITY_FIRST: Record<string, Modality[]> = {
  Cardiology: ["ecg"], Respiratory: ["xray"], Neurology: ["ct"], Surgery: ["xray", "ct"], Emergency: ["ecg", "xray"],
  OBGYN: ["usg"], Gastroenterology: ["usg", "ct"], Urology: ["usg", "ct"], Orthopedics: ["xray"], "Infectious Disease": ["smear"],
};

/** Skills Lab: a short list of drills — tap one; nothing loads until then. */
export function SkillsLab({ stats }: { stats: PracticeStats[] }) {
  const me = useMe();
  const stage = useCareerStage();
  const specialty = me?.user.specialty && me.user.specialty !== "mixed" ? me.user.specialty : null;
  const level: SkillLevel = stage === "student" || stage === "intern" ? "basic" : "full";
  const [section, setSection] = useState<Section | null>(null);

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("drill");
    if (d && d in SECTIONS) setSection(d as Section);
  }, []);

  const order = useMemo(() => {
    const all = Object.keys(SECTIONS) as Section[];
    const first = stage === "radiologist" ? (["radiology", "spot"] as Section[]) : specialty ? FIRST[specialty] ?? [] : [];
    // Radiology reporting is for radiologists and seniors; students see it last.
    const rest = all.filter((s) => !first.includes(s));
    if (level === "basic") rest.sort((a, b) => Number(a === "radiology") - Number(b === "radiology"));
    return [...first, ...rest];
  }, [stage, specialty, level]);

  const modalities = useMemo(() => {
    const first = specialty ? MODALITY_FIRST[specialty] ?? [] : [];
    return [...first, ...MODALITY_IDS.filter((m) => !first.includes(m))];
  }, [specialty]);

  const progress = useSkillProgress();
  // Mastered of total, per section (radiology: of the studies tried, as its bank grows).
  const bar = (id: Section): [number, number] => {
    if (id === "spot") return [progress("spot:").mastered, MODALITY_IDS.reduce((n, m) => n + MODALITIES[m].items.length, 0)];
    if (id === "radiology") { const r = progress("radio:"); return [r.mastered, Math.max(r.tried, 40)]; }
    if (id === "sounds") return [progress("sound:").mastered, HEART_CASES.length + LUNG_CASES.length];
    if (id === "antidotes") return [progress("quiz:antidote-").mastered, ANTIDOTE_COUNT];
    if (id === "algorithms") return [progress("quiz:algo-").mastered, ALGORITHM_COUNT];
    return [progress("quiz:calc-").mastered, CALCULATION_COUNT];
  };

  const [cat, setCat] = useState<string | null>(null);
  const antidotes = useCallback(() => antidoteQuestions(level, specialty, cat ?? undefined), [level, specialty, cat]);
  const algorithms = useCallback(() => algorithmQuestions(level, specialty, cat ?? undefined), [level, specialty, cat]);
  const calculations = useCallback(() => calculationQuestions(level, specialty, cat ?? undefined), [level, specialty, cat]);

  if (!section) {
    // Three kinds of drill, each its own group: what you see, what you hear, what you must know.
    const groups: [string, string, Section[]][] = [
      ["👁️ See it", "Name what's on the image", ["spot", "radiology"]],
      ["👂 Hear it", "Name what's on the stethoscope", ["sounds"]],
      ["🧠 Know it", "Quick-fire, high-yield", ["antidotes", "algorithms", "calculations"]],
    ];
    // The doctor's own drills lead within each group.
    const rank = (id: Section) => order.indexOf(id);
    return (
      <div className="flex flex-col gap-6 py-6">
        <header>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Skills Lab</h1>
          <p className="mt-1 text-[14.5px] text-fg-2">{level === "basic" ? "Must-know drills for your level — a few minutes each." : "Short drills — a few minutes each."}</p>
          <Link href="/revision" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-line hover:bg-surface-3">📚 Revision deck</Link>
        </header>
        {groups.map(([title, note, ids]) => (
          <section key={title} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[16px] font-semibold">{title}</h2>
              <span className="text-[12.5px] text-fg-3">{note}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...ids].sort((x, y) => rank(x) - rank(y)).map((id) => {
                const [label, sub] = SECTIONS[id];
                const [emoji, ...words] = label.split(" ");
                return (
                  <button key={id} type="button" onClick={() => setSection(id)} className="group flex min-h-[72px] items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-surface-2 hover:shadow-md active:scale-[0.99]">
                    <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-[22px]">{emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{words.join(" ")}</span>
                      <span className="block text-[12.5px] leading-5 text-fg-2">{sub}</span>
                      <SkillBar mastered={bar(id)[0]} total={bar(id)[1]} className="mt-1.5" />
                    </span>
                    <span aria-hidden className="text-fg-3 transition-transform group-hover:translate-x-0.5">›</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => { setSection(null); setCat(null); }} className="h-9 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-medium hover:bg-surface-2">
          ← Skills Lab
        </button>
        <h1 className="min-w-0 flex-1 text-[20px] font-semibold tracking-[-0.02em]">{SECTIONS[section][0]}</h1>
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
              <button key={c ?? "all"} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap", cat === c ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2 hover:text-fg")}>
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
