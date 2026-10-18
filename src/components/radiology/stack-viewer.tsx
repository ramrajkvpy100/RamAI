"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A CT or MRI series to scroll through, as at a workstation: drag up and down (or swipe, or use the
 * wheel, or the slider) to move through the slices. All slices are preloaded so scrolling is smooth.
 */
export function StackViewer({ id, slices, label }: { id: string; slices: number; label: string }) {
  const [i, setI] = useState(Math.floor(slices / 2));
  const drag = useRef<{ y: number; at: number } | null>(null);
  const urls = Array.from({ length: slices }, (_, n) => `/radiology/${id}/${String(n).padStart(3, "0")}.jpg`);

  useEffect(() => {
    setI(Math.floor(slices / 2));
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, slices]);

  const clamp = (n: number) => Math.max(0, Math.min(slices - 1, n));
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative touch-none overflow-hidden rounded-xl bg-black select-none"
        onWheel={(e) => setI((n) => clamp(n + Math.sign(e.deltaY)))}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, at: i };
        }}
        onPointerMove={(e) => drag.current && setI(clamp(drag.current.at + Math.round((e.clientY - drag.current.y) / 6)))}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        aria-label={`${label} — slice ${i + 1} of ${slices}. Drag up or down to scroll.`}
        role="img"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[i]} alt="" draggable={false} className="mx-auto aspect-square w-full max-w-[520px] object-contain" />
        <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11.5px] text-white/85 tabular">{i + 1} / {slices}</span>
        <span className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white/70">↕ drag to scroll</span>
      </div>
      <input type="range" min={0} max={slices - 1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="Slice" className="w-full accent-[var(--accent)]" />
    </div>
  );
}
