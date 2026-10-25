"use client";

import { useRef, useState } from "react";

import { Portal } from "@/components/ui/portal";
import { Icon } from "@/components/ui/icon";
import { tap } from "@/lib/haptics";

/** A picture that opens full screen on tap, to pinch, wheel or double-tap zoom and drag around. */
export function ZoomImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ d: number; s: number; x: number; y: number; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);
  const close = () => { setOpen(false); setZ({ s: 1, x: 0, y: 0 }); };
  const clampS = (s: number) => Math.max(1, Math.min(6, s));
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onClick={() => { tap(); setOpen(true); }} className={`${className ?? ""} cursor-zoom-in`} draggable={false} />
      {open && (
        <Portal>
          <div role="dialog" aria-label="Zoomed picture" className="fixed inset-0 z-[95] flex animate-fade items-center justify-center bg-black/95 touch-none select-none"
            onWheel={(e) => setZ((v) => ({ ...v, s: clampS(v.s * (e.deltaY < 0 ? 1.15 : 0.87)) }))}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const now = Date.now();
              if (pts.current.size === 1 && now - lastTap.current < 280) setZ((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : { ...v, s: 2.5 }));
              lastTap.current = now;
              const p = [...pts.current.values()];
              start.current = { d: p.length > 1 ? Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y) : 0, s: z.s, x: z.x, y: z.y, cx: e.clientX, cy: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!pts.current.has(e.pointerId) || !start.current) return;
              pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const p = [...pts.current.values()];
              const st = start.current;
              if (p.length > 1 && st.d) setZ((v) => ({ ...v, s: clampS(st.s * (Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y) / st.d)) }));
              else if (z.s > 1) setZ((v) => ({ ...v, x: st.x + (e.clientX - st.cx), y: st.y + (e.clientY - st.cy) }));
            }}
            onPointerUp={(e) => { pts.current.delete(e.pointerId); start.current = null; }}
            onPointerCancel={(e) => { pts.current.delete(e.pointerId); start.current = null; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} draggable={false} className="max-h-full max-w-full object-contain will-change-transform" style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})` }} />
            <button type="button" onClick={close} aria-label="Close" className="absolute top-[max(16px,env(safe-area-inset-top))] right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur">
              <Icon name="x" size={18} />
            </button>
            <span className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/70">Pinch or double-tap to zoom</span>
          </div>
        </Portal>
      )}
    </>
  );
}
