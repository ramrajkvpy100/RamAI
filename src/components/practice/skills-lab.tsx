"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { useCareerStage } from "@/lib/career-stage";
import { useMe } from "@/lib/me-store";
import { SKILL_COUNTS } from "@/lib/skill-counts";
import { useSkillProgress } from "@/lib/skill-progress";

import { SkillBar } from "./progress-bar";
import type { Section } from "./skill-section";

/** The drills load when one is opened; the banks are large. */
const SkillSection = dynamic(() => import("./skill-section").then((x) => x.SkillSection), { ssr: false, loading: () => <div className="flex flex-col gap-4 py-6">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div> });

type SkillLevel = "basic" | "full";
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

/** Mastery as a ring round the drill's icon. */
function SkillRing({ mastered, total, emoji }: { mastered: number; total: number; emoji?: string }) {
  const r = 20, c = 2 * Math.PI * r, share = total ? Math.min(1, mastered / total) : 0;
  return (
    <span aria-hidden className="relative flex h-12 w-12 shrink-0 items-center justify-center text-[20px]">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line)" strokeWidth="3.5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--success)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - share)} style={{ transition: "stroke-dashoffset 430ms var(--ease-out-soft)" }} />
      </svg>
      {emoji}
    </span>
  );
}

/** Skills Lab: a short list of drills — tap one; nothing loads until then. */
export function SkillsLab() {
  const me = useMe();
  // Ready before the tap: the drills' code arrives once this page has settled.
  useEffect(() => {
    const later = window.setTimeout(() => void import("./skill-section"), 800);
    return () => window.clearTimeout(later);
  }, []);
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

  const progress = useSkillProgress();
  // Mastered of total, per section (radiology: of the studies tried, as its bank grows).
  const bar = (id: Section): [number, number] => {
    if (id === "spot") return [progress("spot:").mastered, SKILL_COUNTS.spot];
    if (id === "radiology") { const r = progress("radio:"); return [r.mastered, Math.max(r.tried, 40)]; }
    if (id === "sounds") return [progress("sound:").mastered, SKILL_COUNTS.sounds];
    if (id === "antidotes") return [progress("quiz:antidote-").mastered, SKILL_COUNTS.antidotes];
    if (id === "algorithms") return [progress("quiz:algo-").mastered, SKILL_COUNTS.algorithms];
    return [progress("quiz:calc-").mastered, SKILL_COUNTS.calculations];
  };

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
                  <button key={id} type="button" onClick={() => setSection(id)} className="widget-glass group flex min-h-[72px] items-center gap-3.5 rounded-2xl px-4 py-3 text-left">
                    <SkillRing mastered={bar(id)[0]} total={bar(id)[1]} emoji={emoji} />
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

  return <SkillSection section={section} title={SECTIONS[section][0]} level={level} specialty={specialty} onBack={() => setSection(null)} />;
}
