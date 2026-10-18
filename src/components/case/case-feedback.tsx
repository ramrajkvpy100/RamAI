"use client";

import { useState } from "react";

import { caseSnapshot } from "@/lib/case-store";
import { cn } from "@/lib/cn";

async function send(kind: "report" | "feedback", reason: string, rating?: 1 | -1): Promise<boolean> {
  const token = caseSnapshot().session?.token;
  if (!token) return false;
  const res = await fetch("/api/cases/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, kind, reason, rating }) }).catch(() => null);
  return !!res?.ok;
}

/** "Report this case": something medically wrong or broken — kept for the weekly review. */
export function ReportCase({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <p className={cn("text-[12.5px] text-success", className)}>Thanks — reported. We review every report each week.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("text-[12.5px] text-fg-3 underline underline-offset-2 hover:text-fg", className)}>
        ⚑ Report this case
      </button>
    );
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 600))} rows={3} placeholder="What's wrong? e.g. 'The potassium doesn't fit the ECG'" className="w-full rounded-xl border border-line bg-surface p-3 text-[14px] outline-none focus:border-accent-line" />
      <div className="flex gap-2">
        <button type="button" disabled={text.trim().length < 3} onClick={async () => setDone(await send("report", text.trim()))} className="h-9 rounded-full bg-accent px-4 text-[13px] font-semibold text-on-accent disabled:opacity-50">Send report</button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-3 text-[13px] text-fg-2">Cancel</button>
      </div>
    </div>
  );
}

const REASONS_UP = ["Realistic", "Learned something", "Good difficulty"];
const REASONS_DOWN = ["Too hard", "Too easy", "Unrealistic", "Confusing"];

/** After the debrief: was this case useful? A thumb, and a reason in one tap. */
export function CaseFeedback({ className }: { className?: string }) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <p className={cn("text-center text-[13px] text-fg-2", className)}>Thanks for the feedback 🙏</p>;
  return (
    <div className={cn("card flex flex-col items-center gap-3 p-5 text-center", className)}>
      <div className="text-[14.5px] font-semibold">Was this case useful?</div>
      <div className="flex gap-2">
        {([1, -1] as const).map((r) => (
          <button key={r} type="button" aria-pressed={rating === r} onClick={() => setRating(r)} className={cn("h-11 w-16 rounded-full border text-[20px]", rating === r ? "border-accent-line bg-accent-soft" : "border-line bg-surface")}>
            {r === 1 ? "👍" : "👎"}
          </button>
        ))}
      </div>
      {rating !== null && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {(rating === 1 ? REASONS_UP : REASONS_DOWN).map((reason) => (
            <button key={reason} type="button" onClick={async () => setDone(await send("feedback", reason, rating))} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-fg-2 hover:bg-surface-2">
              {reason}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
