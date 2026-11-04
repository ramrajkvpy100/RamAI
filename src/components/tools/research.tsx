"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";
import { isIndian, RESEARCH, RESEARCH_KINDS, RESEARCH_SPECIALTIES, type ResearchItem } from "@/lib/tools/research";

import { ToolHeader } from "./tool-parts";

const SAVED = "ramai.research.saved";
const readSaved = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SAVED) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const SPECIALTY_NAME: Record<string, string> = { OBGYN: "OB/GYN" };

export function ResearchTool() {
  const [kind, setKind] = useState<(typeof RESEARCH_KINDS)[number]>("All");
  const [specialty, setSpecialty] = useState("All");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  useEffect(() => setSaved(readSaved()), []);
  const toggle = (id: string) => {
    tap();
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem(SAVED, JSON.stringify(next));
    } catch {}
  };
  const q = search.trim().toLowerCase();
  const list = RESEARCH
    .filter((r) => (kind === "All" || (kind === "Guidelines" && r.kind === "Guideline") || (kind === "Trials" && r.kind === "Trial") || (kind === "India" && isIndian(r))))
    .filter((r) => specialty === "All" || r.specialty === specialty)
    .filter((r) => !onlySaved || saved.includes(r.id))
    .filter((r) => !q || `${r.title} ${r.takeaway} ${r.bedside} ${r.body} ${r.specialty}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.year) - Number(a.year));
  const chip = (on: boolean) => cn("shrink-0 rounded-full border px-3 py-1 text-[13px] font-semibold", on ? "border-transparent bg-[#2563EB] text-white" : "border-line bg-surface text-fg-2");
  return (
    <div className="pb-6">
      <ToolHeader title="Latest research" line={`${RESEARCH.length} guidelines and trials that change what you do, newest first.`} />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search: sepsis, TB, heart failure…" className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[14.5px] outline-none placeholder:text-fg-3" />
      <div className="mt-2.5 flex gap-1 rounded-xl bg-surface-3 p-1 text-[13.5px] font-semibold">
        {RESEARCH_KINDS.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("flex-1 rounded-lg py-1.5", kind === k && "bg-[var(--surface-solid)] shadow-sm")}>{k}</button>)}
      </div>
      <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" aria-pressed={onlySaved} onClick={() => setOnlySaved((x) => !x)} className={chip(onlySaved)}>★ Saved ({saved.length})</button>
        {RESEARCH_SPECIALTIES.map((x) => <button key={x} type="button" aria-pressed={specialty === x} onClick={() => setSpecialty(x)} className={chip(specialty === x)}>{SPECIALTY_NAME[x] ?? x}</button>)}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {list.map((r) => <Item key={r.id} r={r} saved={saved.includes(r.id)} onSave={() => toggle(r.id)} />)}
        {!list.length && <p className="py-6 text-center text-[14px] text-fg-2">Nothing matches that yet.</p>}
      </div>
      <p className="mt-4 text-[12px] leading-[18px] text-fg-3">Teaching summaries, each linked to its source. Read the source before changing your practice.</p>
    </div>
  );
}

function Item({ r, saved, onSave }: { r: ResearchItem; saved: boolean; onSave: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-2xl border border-line bg-[var(--surface-solid)] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold tracking-wide uppercase">
          <span className={cn("rounded px-1.5 py-0.5", r.kind === "Trial" ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300")}>{r.kind}</span>
          {isIndian(r) && <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-700 dark:text-orange-300">India</span>}
          <span className="text-fg-2">{r.kind === "Trial" ? "" : `${r.body} · `}{r.year} · {SPECIALTY_NAME[r.specialty] ?? r.specialty}</span>
        </p>
        <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} className={cn("shrink-0 text-[20px] leading-none", saved ? "text-amber-500" : "text-fg-3")}>{saved ? "★" : "☆"}</button>
      </div>
      <h2 className="mt-1.5 text-[16.5px] leading-[22px] font-bold">{r.title}</h2>
      {r.numbers && <p className="mt-2 rounded-lg bg-surface-3 px-2.5 py-1.5 text-[14px] leading-5 font-bold tabular">{r.numbers}</p>}
      <div className="mt-2.5 rounded-xl bg-blue-500/10 p-3">
        <p className="text-[12px] font-extrabold tracking-wide">1-MINUTE TAKEAWAY</p>
        <p className="mt-0.5 text-[14px] leading-[21px]">{r.takeaway}</p>
      </div>
      <button type="button" onClick={() => { tap(); setOpen((x) => !x); }} aria-expanded={open} className="mt-2 text-[13.5px] font-semibold text-accent-text">{open ? "Show less" : "At the bedside, and in the exam"} {open ? "▴" : "▾"}</button>
      {open && (
        <div className="mt-2 flex animate-rise flex-col gap-2">
          <div className="rounded-xl bg-emerald-500/10 p-3">
            <p className="text-[12px] font-extrabold tracking-wide">HOW THIS CHANGES BEDSIDE PRACTICE</p>
            <p className="mt-0.5 text-[14px] leading-[21px]">{r.bedside}</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 p-3">
            <p className="text-[12px] font-extrabold tracking-wide">EXAM ANGLE</p>
            <p className="mt-0.5 text-[14px] leading-[21px]">{r.exam}</p>
          </div>
        </div>
      )}
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-[13.5px] font-semibold text-accent-text underline">Read the source</a>
    </article>
  );
}
