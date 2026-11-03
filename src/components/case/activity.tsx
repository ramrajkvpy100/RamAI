"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";

export type Activity = "exam" | "drug" | "lab" | "chat";

/** What the running order is doing, from its words alone. */
export function activityOf(input: string): Activity {
  if (/\?\s*$|^(any|do|does|did|how|what|when|where|why|are|is|have|has|tell)\b/i.test(input)) return "chat";
  if (/\b(cbc|rft|lft|abg|ecg|x-?ray|cxr|ct|mri|usg|ultrasound|culture|test|labs?|troponin|panel|electrolytes|smear|echo)\b/i.test(input)) return "lab";
  if (/\b(give|start|inj|iv|im|po|mg|mcg|ml|litres?|tablet|tab|prescribe|bolus|infusion|neb|oxygen)\b/i.test(input)) return "drug";
  if (/\b(examine|exam|auscultat|listen|palpate|inspect|look|abcde|chest|abdomen|cvs|cns|vitals)\b/i.test(input)) return "exam";
  return "chat";
}

const LABEL: Record<Activity, string> = { exam: "Examining", drug: "Giving it", lab: "Running the test", chat: "Waiting for the reply" };

/** A small moving picture of the work under way, in place of three plain dots. */
export function ActivityGlyph({ kind }: { kind: Activity }) {
  return (
    <span className="flex items-center gap-2 text-fg-3">
      <span className="sr-only">{LABEL[kind]}</span>
      {kind === "exam" && (
        <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden className="text-accent-text">
          <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.2" className="animate-[ring-out_1.2s_ease-out_infinite] [transform-box:fill-box] [transform-origin:center]" />
          <path d="M14 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {kind === "drug" && (
        <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden className="text-sky-500">
          <rect x="5" y="1" width="10" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="6.5" y="4" width="7" height="7.5" rx="1" fill="currentColor" opacity="0.3" />
          <path d="M10 13v3" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="10" cy="17" r="1.4" fill="currentColor" className="animate-[iv-drip_1s_ease-in_infinite]" />
        </svg>
      )}
      {kind === "lab" && (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="animate-spin text-violet-500 [animation-duration:1.1s]">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
          <circle cx="12" cy="4.5" r="2" fill="currentColor" />
          <circle cx="18.5" cy="16" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="5.5" cy="16" r="2" fill="currentColor" opacity="0.45" />
        </svg>
      )}
      {kind === "chat" && [0, 1, 2].map((i) => <span key={i} aria-hidden className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-fg-3" style={{ animationDelay: `${i * 0.18}s` }} />)}
      {kind !== "chat" && <span className="text-[12.5px]">{LABEL[kind]}…</span>}
    </span>
  );
}

const span = (minutes: number) => {
  if (minutes >= 60 * 24 * 7) { const w = Math.round(minutes / (60 * 24 * 7)); return `${w} ${w === 1 ? "week" : "weeks"}`; }
  if (minutes >= 60 * 24) { const d = Math.round(minutes / (60 * 24)); return `${d} ${d === 1 ? "day" : "days"}`; }
  if (minutes >= 60) { const h = Math.round(minutes / 60); return `${h} ${h === 1 ? "hr" : "hrs"}`; }
  return `${minutes} min`;
};

/** When the clock jumps (a drug's peak, a follow-up): a pill sweeps across, counting up what's gone by. Short steps pass without it. */
export function TimeJump({ clock, from = 15 }: { clock: number; from?: number }) {
  const last = useRef(clock);
  const [jump, setJump] = useState<{ minutes: number; n: number } | null>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const d = clock - last.current;
    last.current = clock;
    if (d < from) return;
    setJump((j) => ({ minutes: d, n: (j?.n ?? 0) + 1 }));
    let raf = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 800);
      setShown(Math.round(d * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const off = window.setTimeout(() => setJump(null), 1900);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(off); };
  }, [clock, from]);
  if (!jump) return null;
  return (
    <div key={jump.n} role="status" className="pointer-events-none absolute top-2 left-1/2 z-20 w-max -translate-x-1/2 animate-enter overflow-hidden rounded-full bg-[#0b1220] px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-lg ring-1 ring-white/15">
      <span className="relative flex items-center gap-2 tabular">
        <Icon name="clock" size={14} className="animate-spin [animation-duration:1.2s]" /> +{span(shown)} elapsed
      </span>
      <span aria-hidden className="sweep-in absolute inset-x-0 bottom-0 h-[2px] bg-sky-400" />
    </div>
  );
}
