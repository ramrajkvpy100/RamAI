"use client";

import { useState } from "react";

import { Sheet } from "@/components/ui/sheet";

const STARTERS = ["Why did I lose marks on this case?", "Walk me through the ideal step-by-step management.", "Explain the pathophysiology behind the abnormal labs and vitals.", "What if I had prescribed a different drug?"];

/** "Ask a doubt": a senior who has the whole case in hand. Nothing is called until the doctor asks. */
export function DoubtButton({ token, className }: { token: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ask = async (question: string) => {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/cases/doubt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, question: q }) });
      const data = (await res.json()) as { answer?: string; error?: { message?: string } };
      if (!res.ok || !data.answer) throw new Error(data.error?.message ?? "The senior can't answer just now. Please try again.");
      setThread((t) => [...t, { q, a: data.answer! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The senior can't answer just now. Please try again.");
      setText(q);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "flex h-11 items-center justify-center rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent"}>Ask a doubt about this case</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ask a senior about this case">
        <div className="flex flex-col gap-3">
          {thread.length === 0 && (
            <div className="flex flex-col gap-1.5">
              {STARTERS.map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => void ask(s)} className="rounded-xl border border-line px-3.5 py-2.5 text-left text-[14px] hover:bg-surface-2 disabled:opacity-60">{s}</button>
              ))}
            </div>
          )}
          {thread.map((t, i) => (
            <div key={i} className="animate-enter">
              <p className="text-[13px] font-semibold text-fg-2">{t.q}</p>
              <p className="selectable mt-1 whitespace-pre-line text-[14.5px] leading-6">{t.a}</p>
            </div>
          ))}
          {busy && <div className="skeleton h-16 rounded-xl" aria-label="The senior is writing" />}
          {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          <form onSubmit={(e) => { e.preventDefault(); void ask(text); }} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="Type your doubt…" aria-label="Your doubt" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[14.5px]" />
            <button type="submit" disabled={busy || text.trim().length < 3} className="h-11 rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent disabled:opacity-50">Ask</button>
          </form>
          <p className="text-[12px] leading-4 text-fg-3">AI answers about a fictional case, for learning. Check guidelines before applying to real patients.</p>
        </div>
      </Sheet>
    </>
  );
}
