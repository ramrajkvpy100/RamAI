"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { Auscultation } from "@/engine/types";
import { cn } from "@/lib/cn";
import { LISTEN_SECONDS, playSounds, stethoscopeSupported } from "@/lib/stethoscope";

const AREA = { heart: "heart", lungs: "chest", bowel: "abdomen" } as const;

/** Listen through the stethoscope — the sounds themselves, never a label for them. */
export function StethoscopePlayer({ sounds }: { sounds: Auscultation[] }) {
  const [left, setLeft] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(stethoscopeSupported()), []);
  useEffect(() => () => stop.current?.(), []);
  useEffect(() => {
    if (left === null) return;
    const t = window.setTimeout(() => setLeft((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => window.clearTimeout(t);
  }, [left]);

  if (!supported) return null;
  const playing = left !== null;
  const toggle = () => {
    if (playing) return stop.current?.();
    setLeft(LISTEN_SECONDS);
    stop.current = playSounds(sounds, LISTEN_SECONDS, () => {
      setLeft(null);
      stop.current = null;
    });
  };
  const where = sounds.map((s) => AREA[s.kind]).join(", then ");

  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-3.5 py-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors", playing ? "bg-fg text-bg" : "bg-accent-soft text-accent-text hover:bg-accent-soft/80")}
      >
        <Icon name={playing ? "x" : "ear"} size={14} />
        {playing ? `Stop · 0:${String(left).padStart(2, "0")}` : "Listen"}
      </button>
      <span className="flex min-w-0 items-center gap-2 text-[12px] text-fg-3">
        {playing ? (
          <span aria-hidden className="flex h-4 items-end gap-[3px]">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="w-[3px] origin-bottom animate-[voice_0.9s_ease-in-out_infinite] rounded-full bg-accent" style={{ height: "100%", animationDelay: `${i * 120}ms` }} />
            ))}
          </span>
        ) : null}
        <span className="truncate">{playing ? `Listening over the ${where}` : `Stethoscope on the ${where} · headphones help`}</span>
      </span>
    </div>
  );
}
