"use client";

import { useEffect, useState } from "react";

interface Data {
  due: { diagnosis: string; specialty: string; best: number; attempts: number }[];
  specialties: { specialty: string; cases: number; average: number }[];
}

/**
 * "Due for review": diagnoses you struggled with, back at growing intervals until you've got them —
 * and your weakest specialty, so you know where to practise.
 */
export function ReviewCard({ onPractise, starting }: { onPractise: (disease: string) => void; starting: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    fetch("/api/review", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => setData(d))
      .catch(() => undefined);
  }, []);
  if (!data) return null;
  const weak = data.specialties.filter((s) => s.cases >= 2)[0];
  if (!data.due.length && !weak) return null;
  return (
    <section className="panel p-5" aria-labelledby="review-heading">
      <h2 id="review-heading" className="text-[15px] font-semibold">🔁 Due for review</h2>
      {data.due.length > 0 ? (
        <>
          <p className="mt-1 text-[12.5px] text-fg-2">Diagnoses you scored under 70 on — they come back until you get them.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.due.map((d) => (
              <button key={d.diagnosis} type="button" disabled={starting} onClick={() => onPractise(d.diagnosis)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] hover:bg-surface-2 disabled:opacity-60">
                {d.diagnosis} <span className="text-fg-3 tabular">· best {d.best}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1 text-[12.5px] text-fg-2">Nothing due today — well done.</p>
      )}
      {weak && (
        <p className="mt-3 text-[13px] text-fg-2">
          Weakest area: <b className="text-fg">{weak.specialty}</b> — average {weak.average} over {weak.cases} cases.
        </p>
      )}
    </section>
  );
}
