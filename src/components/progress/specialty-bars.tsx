"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

/** Your average score in each specialty — weakest first — with a bar each, so gaps are obvious. */
export function SpecialtyBars() {
  const [rows, setRows] = useState<{ specialty: string; cases: number; average: number }[] | null>(null);
  useEffect(() => {
    fetch("/api/review", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(d?.specialties ?? []))
      .catch(() => setRows([]));
  }, []);
  if (!rows?.length) return null;
  return (
    <section className="panel p-5" aria-labelledby="spec-heading">
      <h2 id="spec-heading" className="text-[15px] font-semibold">By specialty</h2>
      <p className="mt-1 text-[12.5px] text-fg-2">Your average score — the weakest at the top.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.specialty}>
            <div className="flex justify-between text-[13px]">
              <span>{r.specialty} <span className="text-fg-3">· {r.cases} case{r.cases === 1 ? "" : "s"}</span></span>
              <span className="font-semibold tabular">{r.average}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className={cn("h-full rounded-full", r.average >= 70 ? "bg-success" : r.average >= 50 ? "bg-amber-400" : "bg-danger")} style={{ width: `${Math.max(4, r.average)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
