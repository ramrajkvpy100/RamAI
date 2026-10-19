"use client";

import { useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { caseSnapshot } from "@/lib/case-store";
import { cn } from "@/lib/cn";

const KINDS = [
  ["fact", "🩺 Wrong medical fact"],
  ["result", "🧪 Wrong result or picture"],
  ["understanding", "💬 Didn't understand me"],
  ["broken", "🛠️ Something broke"],
  ["other", "✏️ Something else"],
] as const;
type Kind = (typeof KINDS)[number][0];

/** The screen as it is now — a small JPEG, for the report. */
async function screenshot(): Promise<string | undefined> {
  try {
    const { toJpeg } = await import("html-to-image");
    const node = document.body;
    const scale = Math.min(1, 900 / Math.max(1, window.innerWidth));
    return await toJpeg(node, {
      quality: 0.72,
      pixelRatio: scale,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#0b0d12",
      width: window.innerWidth,
      height: window.innerHeight,
      style: { transform: `translateY(-${window.scrollY}px)` },
      // Only the page: no dialogs, no pictures from other sites.
      filter: (el) => !(el instanceof HTMLDialogElement) && !(el instanceof HTMLIFrameElement),
      skipFonts: true,
    });
  } catch {
    return undefined;
  }
}

/** The last part of the conversation, as text, for the report. */
function transcript(): string {
  const state = caseSnapshot().session?.state;
  if (!state) return "";
  const who: Record<string, string> = { doctor: "Doctor", patient: "Patient", attendant: "Relative", nurse: "Nurse", system: "Ward" };
  return state.messages
    .slice(-20)
    .map((m) => `${who[m.role] ?? m.role}: ${m.text}`)
    .join("\n")
    .slice(-7900);
}

/** Outside a case: which drill or question, and the question as shown. */
export interface ReportTarget {
  area: "skills" | "exam";
  ref: string;
  details?: string;
}

const DRILL_KINDS = [
  ["fact", "🩺 Wrong medical fact"],
  ["result", "❌ Wrong answer or picture"],
  ["understanding", "❓ Unclear question"],
  ["broken", "🛠️ Something broke"],
  ["other", "✏️ Something else"],
] as const;

/**
 * 🚩 — two taps to tell RamAI what's wrong: the screen goes with it, and in a case the conversation,
 * in a drill or exam the question itself.
 */
export function ReportProblem({ target, compact = false }: { target?: ReportTarget; compact?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<string | undefined>();
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "capturing" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    // The picture first, before the box covers the screen.
    setState("capturing");
    setShot(await screenshot());
    setState("idle");
    setKind(null);
    setNote("");
    setError(null);
    setOpen(true);
  };

  const send = async () => {
    if (!kind) return;
    const session = caseSnapshot().session;
    if (!target && !session) return;
    setState("sending");
    setError(null);
    const res = await (target
      ? fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, category: kind, reason: note.trim(), screenshot: shot }) })
      : fetch("/api/cases/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: session!.token, kind: "report", category: kind, reason: note.trim(), screenshot: shot, transcript: transcript(), caseNumber: session!.state.caseNumber }),
        })
    ).catch(() => null);
    if (!res?.ok) {
      setState("idle");
      return setError("That didn't send. Please try again.");
    }
    setState("sent");
    setTimeout(() => {
      setOpen(false);
      setState("idle");
    }, 1600);
  };

  return (
    <>
      <button type="button" onClick={() => void start()} disabled={state === "capturing"} aria-label={target ? "Report a problem with this question" : "Report a problem in this case"} title="Report a problem" className="flex h-8 items-center gap-1 rounded-full bg-danger-soft px-2.5 text-[12.5px] font-semibold text-danger hover:brightness-110 disabled:opacity-60">
        🚩<span className={compact ? "" : "hidden sm:inline"}>{state === "capturing" ? "…" : "Report"}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Report a problem" description={target ? "The screen and the question are attached — just pick what's wrong." : "The screen and the conversation are attached — just pick what's wrong."} placement="responsive">
        {state === "sent" ? (
          <p className="py-8 text-center text-[15px] font-semibold text-success">✓ Thank you — sent to the RamAI team.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid gap-2">
              {(target ? DRILL_KINDS : KINDS).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={cn("flex min-h-12 items-center rounded-xl border px-4 text-left text-[14.5px] font-medium", kind === id ? "border-accent-line bg-accent-soft text-accent-text" : "border-line bg-surface hover:bg-surface-2")}>
                  {label}
                </button>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 600))} rows={2} placeholder="What was wrong? (optional)" className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-accent-line" />
            {shot && (
              <div className="flex items-center gap-3 text-[12.5px] text-fg-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot} alt="Screenshot to be sent" className="h-16 w-auto rounded-lg border border-line" />
                📸 Screenshot attached
              </div>
            )}
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <button type="button" onClick={() => void send()} disabled={!kind || state === "sending"} className="h-12 rounded-full bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-50">
              {state === "sending" ? "Sending…" : "Send report"}
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
