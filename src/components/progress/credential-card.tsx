"use client";

import { useEffect, useState } from "react";

import { cvBullet, type CareerIndices } from "@/engine/career";
import { useMe } from "@/lib/me-store";
import { useSkillProgress } from "@/lib/skill-progress";
import { SKILL_COUNTS } from "@/lib/skill-counts";

interface Credential {
  name: string;
  rating: number;
  rank: string;
  top: number | null;
  ratedCases: number;
  indices: CareerIndices;
  mastery: { specialty: string; cases: number; percent: number }[];
  mentor: boolean;
}
interface Mine {
  credential: Credential;
  verifyId: string | null;
  unlocked: boolean;
  minCases: number;
}

const INDICES: [keyof Omit<CareerIndices, "cases">, string][] = [
  ["diagnosticPrecision", "Diagnostic Precision"],
  ["zeroHarm", "Patient Safety & Zero-Harm"],
  ["stabilisationSpeed", "Emergency Stabilization Speed"],
  ["stewardship", "Investigation Stewardship"],
];

/** The rating as something for a CV: the four career indices, Skills Lab mastery, a line to copy, and a link anyone can check. */
export function CredentialCard() {
  const me = useMe();
  const [mine, setMine] = useState<Mine | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const progress = useSkillProgress();
  useEffect(() => {
    fetch("/api/progress/certificate", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setMine).catch(() => undefined);
  }, []);
  if (!me || me.user.isGuest || !mine) return null;
  const c = mine.credential;
  const link = mine.verifyId ? `${window.location.origin}/verify/${mine.verifyId}` : null;
  const copy = async () => {
    await navigator.clipboard.writeText(cvBullet({ rating: c.rating, rank: c.rank, top: c.top, cases: c.ratedCases, indices: c.indices, link }));
    setCopied(true);
  };
  const toggleLink = async () => {
    setNote(null);
    const res = await fetch("/api/progress/certificate", { method: link ? "DELETE" : "POST" });
    const data = (await res.json().catch(() => ({}))) as { verifyId?: string; error?: { message?: string } };
    if (!res.ok) return setNote(data.error?.message ?? "Couldn't change that. Please try again.");
    setMine({ ...mine, verifyId: data.verifyId ?? null });
  };
  const skills: [string, number, number][] = [
    ["See it", progress("spot:").mastered + progress("radio:").mastered, SKILL_COUNTS.spot],
    ["Hear it", progress("sound:").mastered, SKILL_COUNTS.sounds],
    ["Know it", progress("quiz:").mastered, SKILL_COUNTS.antidotes + SKILL_COUNTS.algorithms + SKILL_COUNTS.calculations],
  ];
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="credential-heading">
      <h2 id="credential-heading" className="text-[16px] font-semibold">CV / Resume Clinical Credential{c.mentor ? " 🎓" : ""}</h2>
      <p className="mt-0.5 text-[13.5px] text-fg-2">{c.rank}{c.top !== null ? ` · Top ${c.top}%` : ""} · Rating {c.rating} · {c.ratedCases} rated {c.ratedCases === 1 ? "case" : "cases"}{c.mentor ? " · Clinical Fellow Mentor" : ""}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {INDICES.map(([key, label]) => (
          <div key={key} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <div className="text-[19px] font-bold tabular">{c.indices[key] === null ? "—" : `${c.indices[key]}%`}</div>
            <div className="text-[12.5px] leading-4 text-fg-2">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {skills.map(([label, done, total]) => (
          <div key={label} className="rounded-xl border border-line px-2 py-2">
            <div className="text-[14px] font-semibold tabular">{done}/{total}</div>
            <div className="text-[12px] text-fg-2">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="h-10 rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent">{copied ? "Copied ✓" : "Copy CV / LinkedIn bullet"}</button>
        {mine.unlocked && c.ratedCases >= mine.minCases && (
          <button type="button" onClick={() => void toggleLink()} className="h-10 rounded-full border border-line px-4 text-[13.5px] font-medium hover:bg-surface-2">{link ? "Turn off public link" : "Create verification link"}</button>
        )}
      </div>
      {link && <p className="mt-2 text-[12.5px] break-all text-fg-2">Anyone with this link sees your name and these scores: <a className="text-accent-text underline" href={link}>{link}</a></p>}
      {!mine.unlocked && <p className="mt-2 text-[12.5px] text-fg-2">Invite 3 colleagues, or go Pro, to unlock a verification link.</p>}
      {mine.unlocked && c.ratedCases < mine.minCases && <p className="mt-2 text-[12.5px] text-fg-2">Finish {mine.minCases - c.ratedCases} more rated cases to create a verification link.</p>}
      {note && <p role="alert" className="mt-2 text-[12.5px] text-danger">{note}</p>}
      <p className="mt-3 text-[12px] leading-4 text-fg-3">A simulation-based self-assessment, not a medical qualification, licence or CME credit.</p>
    </section>
  );
}
