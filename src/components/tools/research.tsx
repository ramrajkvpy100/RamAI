"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { RESEARCH, RESEARCH_BODIES } from "@/lib/tools/research";

import { ToolHeader } from "./tool-parts";

export function ResearchTool() {
  const [body, setBody] = useState<(typeof RESEARCH_BODIES)[number]>("All");
  const list = RESEARCH.filter((r) => body === "All" || r.body === body);
  return (
    <div className="pb-6">
      <ToolHeader title="Latest research" line="Guidelines and trials that change what you do. Read the source before changing your practice." />
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {RESEARCH_BODIES.map((b) => (
          <button key={b} type="button" aria-pressed={body === b} onClick={() => setBody(b)} className={cn("shrink-0 rounded-full border px-3 py-1 text-[13px] font-semibold", body === b ? "border-transparent bg-[#2563EB] text-white" : "border-line bg-surface text-fg-2")}>{b}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {list.map((r) => (
          <article key={r.id} className="rounded-2xl border border-line bg-[var(--surface-solid)] p-4">
            <p className="text-[12px] font-bold tracking-wide text-accent-text uppercase">{r.body === "Trial" ? "Trial" : r.body} · {r.year}</p>
            <h2 className="mt-1 text-[16.5px] leading-[22px] font-bold">{r.title}</h2>
            <div className="mt-2.5 rounded-xl bg-blue-500/10 p-3">
              <p className="text-[12px] font-extrabold tracking-wide">1-MINUTE TAKEAWAY</p>
              <p className="mt-0.5 text-[14px] leading-[21px]">{r.takeaway}</p>
            </div>
            <div className="mt-2 rounded-xl bg-emerald-500/10 p-3">
              <p className="text-[12px] font-extrabold tracking-wide">HOW THIS CHANGES BEDSIDE PRACTICE</p>
              <p className="mt-0.5 text-[14px] leading-[21px]">{r.bedside}</p>
            </div>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-block text-[13.5px] font-semibold text-accent-text underline">Read the source</a>
          </article>
        ))}
        {!list.length && <p className="py-6 text-center text-[14px] text-fg-2">Nothing from this source yet.</p>}
      </div>
    </div>
  );
}
