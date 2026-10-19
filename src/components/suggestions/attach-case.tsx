"use client";

import { useCase } from "@/lib/case-store";
import { useMe } from "@/lib/me-store";

/** "Attach a case" — the case the suggestion is about: the one being played, or one of the last ten. */
export function AttachCase({ value, onChange }: { value: string; onChange: (note: string) => void }) {
  const me = useMe();
  const live = useCase();
  const history = [...(me?.progress.history ?? [])].reverse().slice(0, 10);
  const options: [string, string][] = [];
  const now = live.session?.state;
  if (now?.caseNumber) options.push([`Case #${now.caseNumber} (playing now)`, `The case I'm playing (#${now.caseNumber})`]);
  for (const h of history) {
    const note = `Case #${h.caseNumber} · ${h.specialty} · ${h.level} · ${h.diagnosis} · score ${h.score} · ${h.completedISO.slice(0, 10)} · id ${h.caseId}`;
    options.push([note, `#${h.caseNumber} ${h.diagnosis} (${h.score})`]);
  }
  if (!options.length) return null;
  return (
    <label className="mt-2 flex items-center gap-2 text-[12.5px] text-fg-2">
      <span aria-hidden>📎</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-fg outline-none focus:border-accent-line" aria-label="Attach a case">
        <option value="">Attach a case (optional)</option>
        {options.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    </label>
  );
}

/** The message with the attached case added at the end. */
export const withCase = (message: string, note: string) => (note ? `${message}\n\n📎 ${note}`.slice(0, 2000) : message);
