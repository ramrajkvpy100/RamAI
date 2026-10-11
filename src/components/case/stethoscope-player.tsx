"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { ListenArea } from "@/engine/types";
import { caseSnapshot } from "@/lib/case-store";
import { cn } from "@/lib/cn";

const AREA = { heart: "heart", lungs: "chest", bowel: "abdomen" } as const;
/** A moment of silence: playing it inside the tap lets iPhone play the real sound once it arrives. */
const SILENCE = "data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
/** Sounds already fetched this visit, by session and message. */
const heard = new Map<string, string>();

/**
 * Listen through the stethoscope. The sound is rendered on the server from
 * the patient's findings and arrives as audio — nothing on the page says
 * what it is, so the only way to know is to listen.
 */
export function StethoscopePlayer({ sessionId, messageId, areas }: { sessionId: string; messageId: string; areas: ListenArea[] }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "playing" | "failed">("idle");
  const [left, setLeft] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const stop = () => {
    audio.current?.pause();
    setPhase("idle");
  };

  const play = async () => {
    const el = (audio.current ??= new Audio());
    el.onended = () => setPhase("idle");
    el.ontimeupdate = () => setLeft(Math.max(0, Math.ceil((el.duration || 12) - el.currentTime)));
    const key = `${sessionId}:${messageId}`;
    let url = heard.get(key);
    if (!url) {
      el.src = SILENCE;
      void el.play().catch(() => {});
      setPhase("loading");
      const token = caseSnapshot().session?.token;
      const res = token ? await fetch("/api/cases/sound", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, messageId }) }).catch(() => null) : null;
      if (!res?.ok) return setPhase("failed");
      url = URL.createObjectURL(await res.blob());
      heard.set(key, url);
    }
    el.src = url;
    setLeft(12);
    setPhase("playing");
    await el.play().catch(() => setPhase("failed"));
  };

  const where = areas.map((a) => AREA[a]).join(", then ");
  const playing = phase === "playing";
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-3.5 py-2.5">
      <button
        type="button"
        onClick={() => (playing || phase === "loading" ? stop() : void play())}
        aria-pressed={playing}
        className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors", playing ? "bg-fg text-bg" : "bg-accent-soft text-accent-text hover:bg-accent-soft/80")}
      >
        <Icon name={playing ? "x" : "ear"} size={14} />
        {playing ? `Stop · 0:${String(left).padStart(2, "0")}` : phase === "loading" ? "Placing the stethoscope…" : "Listen"}
      </button>
      <span className="flex min-w-0 items-center gap-2 text-[12px] text-fg-3">
        {playing ? (
          <span aria-hidden className="flex h-4 items-end gap-[3px]">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="w-[3px] origin-bottom animate-[voice_0.9s_ease-in-out_infinite] rounded-full bg-accent" style={{ height: "100%", animationDelay: `${i * 120}ms` }} />
            ))}
          </span>
        ) : null}
        <span className="truncate">
          {phase === "failed" ? "Couldn't play that — tap Listen to try again." : playing ? `Listening over the ${where}` : `Stethoscope on the ${where} · headphones help`}
        </span>
      </span>
    </div>
  );
}
