"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { tap } from "@/lib/haptics";

type Plane = "axial" | "sagittal" | "coronal";

/** Display window: how the grey levels are spread (brightness/contrast, as a workstation's window/level). */
const PRESETS = [
  { id: "default", label: "As acquired", w: 255, l: 128 },
  { id: "soft", label: "Soft tissue", w: 170, l: 120 },
  { id: "bright", label: "Dark areas", w: 140, l: 70 },
  { id: "dense", label: "Dense areas", w: 120, l: 190 },
] as const;

/**
 * A CT or MRI series to scroll through, as at a workstation. The slices are decoded once and drawn on a canvas (no
 * image swapping, so scrolling stays smooth on any phone). Axial as acquired; sagittal and coronal reformatted from
 * the same slices; window/level by preset or by dragging sideways; full screen.
 */
export function StackViewer({ id, slices, label, windows }: { id: string; slices: number; label: string; /** True CT windows saved from the original scan ("soft", "lung", "bone"). */ windows?: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const vol = useRef<{ w: number; h: number; n: number; data: Uint8Array } | null>(null);
  const pos = useRef({ axial: Math.floor(slices / 2), sagittal: 0, coronal: 0 });
  const win = useRef({ w: 255, l: 128 });
  const raf = useRef(0);
  const [plane, setPlane] = useState<Plane>("axial");
  const [loaded, setLoaded] = useState(0);
  const [counter, setCounter] = useState({ i: Math.floor(slices / 2), of: slices });
  const [preset, setPreset] = useState<string>("default");
  /** Which saved window the slices come from (CT with true windows); "" = the stack as first shown. */
  const [folder, setFolder] = useState("");
  const [full, setFull] = useState(false);
  const drag = useRef<{ x: number; y: number; at: number; w: number; l: number } | null>(null);
  const planeRef = useRef<Plane>("axial");
  planeRef.current = plane;

  const count = (p: Plane) => {
    const v = vol.current;
    if (!v) return slices;
    return p === "axial" ? v.n : p === "sagittal" ? v.w : v.h;
  };

  /** Draws the current slice of the current plane, at most once a frame. */
  const draw = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const v = vol.current;
      const c = canvas.current;
      if (!v || !c) return;
      const p = planeRef.current;
      const i = pos.current[p];
      const [ow, oh] = p === "axial" ? [v.w, v.h] : p === "sagittal" ? [v.h, v.n] : [v.w, v.n];
      if (c.width !== ow || c.height !== oh) {
        c.width = ow;
        c.height = oh;
        // Reformats: the stack's slices are thicker than its pixels — stretched to a natural shape, never squashed flat.
        // Axial at its own shape (some MRI slices aren't square — never squeezed into a square).
        c.style.aspectRatio = p === "axial" ? `${ow} / ${oh}` : `${ow} / ${Math.min(Math.max(v.w, v.h), oh * 6)}`;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(ow, oh);
      const { w: ww, l } = win.current;
      const lo = l - ww / 2;
      const scale = 255 / Math.max(1, ww);
      const plane = v.w * v.h;
      for (let y = 0; y < oh; y++) {
        for (let x = 0; x < ow; x++) {
          // Sagittal and coronal: the head of the stack at the top.
          const src = p === "axial" ? i * plane + y * v.w + x : p === "sagittal" ? (v.n - 1 - y) * plane + x * v.w + i : (v.n - 1 - y) * plane + i * v.w + x;
          const g = Math.max(0, Math.min(255, (v.data[src]! - lo) * scale));
          const o = (y * ow + x) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
          img.data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      setCounter({ i, of: count(p) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load every slice once, as grey levels in one volume.
  useEffect(() => {
    let off = false;
    const keep = vol.current ? { ...pos.current } : null;
    vol.current = null;
    setLoaded(0);
    pos.current = keep ?? { axial: Math.floor(slices / 2), sagittal: 0, coronal: 0 };
    (async () => {
      const urls = Array.from({ length: slices }, (_, n) => `/radiology/${id}/${folder ? `${folder}/` : ""}${String(n).padStart(3, "0")}.jpg`);
      let done = 0;
      const imgs = await Promise.all(
        urls.map((u) =>
          fetch(u)
            .then((r) => r.blob())
            .then((b) => createImageBitmap(b))
            .then((bm) => {
              if (!off) setLoaded(++done);
              return bm;
            }),
        ),
      ).catch(() => null);
      if (off || !imgs?.length) return;
      const w = imgs[0]!.width, h = imgs[0]!.height;
      const work = document.createElement("canvas");
      work.width = w;
      work.height = h;
      const wctx = work.getContext("2d", { willReadFrequently: true })!;
      const data = new Uint8Array(w * h * imgs.length);
      imgs.forEach((bm, z) => {
        wctx.drawImage(bm, 0, 0, w, h);
        const px = wctx.getImageData(0, 0, w, h).data;
        for (let k = 0; k < w * h; k++) data[z * w * h + k] = px[k * 4]!;
        bm.close();
      });
      vol.current = { w, h, n: imgs.length, data };
      if (!keep) pos.current = { axial: Math.floor(imgs.length / 2), sagittal: Math.floor(w / 2), coronal: Math.floor(h / 2) };
      draw();
    })();
    return () => {
      off = true;
      cancelAnimationFrame(raf.current);
    };
  }, [id, slices, folder, draw]);

  useEffect(() => draw(), [plane, draw]);

  const step = (d: number) => {
    const p = planeRef.current;
    pos.current[p] = Math.max(0, Math.min(count(p) - 1, pos.current[p] + d));
    draw();
  };

  const setWindow = (w: number, l: number) => {
    win.current = { w: Math.max(20, Math.min(400, w)), l: Math.max(0, Math.min(255, l)) };
    draw();
  };

  const toggleFull = async () => {
    tap();
    const el = box.current;
    if (!document.fullscreenElement && el?.requestFullscreen) {
      await el.requestFullscreen().catch(() => setFull(true));
      setFull(true);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      setFull(false);
    } else setFull((f) => !f);
  };
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const ready = loaded >= slices && vol.current;
  return (
    <div ref={box} className={cn("flex flex-col gap-2", full && "fixed inset-0 z-[80] bg-black p-3 sm:p-6")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-full bg-surface-3 p-0.5 text-[12.5px]">
          {(["axial", "sagittal", "coronal"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={plane === p} onClick={() => { tap(); setPlane(p); }} className={cn("rounded-full px-3 py-1 font-medium capitalize", plane === p ? "bg-surface text-fg shadow-sm" : "text-fg-2")}>
              {p}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void toggleFull()} aria-label={full ? "Exit full screen" : "Full screen"} className="ml-auto flex h-8 items-center gap-1 rounded-full bg-surface-3 px-3 text-[12.5px] font-medium text-fg-2 hover:text-fg">
          <Icon name={full ? "close" : "maximize"} size={13} /> {full ? "Close" : "Full screen"}
        </button>
      </div>
      <div
        className={cn("relative touch-none overflow-hidden rounded-xl bg-black select-none", full && "flex-1")}
        onWheel={(e) => step(Math.sign(e.deltaY))}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, at: pos.current[planeRef.current], ...win.current };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          // Up and down scrolls the slices; sideways (with two fingers' worth of travel) changes the window.
          if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 12) {
            setPreset("custom");
            setWindow(d.w + dx, d.l);
          } else {
            const p = planeRef.current;
            pos.current[p] = Math.max(0, Math.min(count(p) - 1, d.at + Math.round(dy / 5)));
            draw();
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => (e.key === "ArrowUp" ? step(-1) : e.key === "ArrowDown" ? step(1) : undefined)}
        tabIndex={0}
        aria-label={`${label} — ${plane}, slice ${counter.i + 1} of ${counter.of}. Drag up or down to scroll, sideways for contrast.`}
        role="img"
      >
        {/* Stretched to the box's true anatomical shape (set in draw) — never letterboxed into a thin strip. */}
        <canvas ref={canvas} className={cn("mx-auto block object-fill [image-rendering:auto]", full ? "h-full w-auto max-w-full" : "w-full max-w-[520px]")} />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12.5px] text-white/80">
            <div className="h-1 w-40 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-white/70 transition-[width]" style={{ width: `${(loaded / slices) * 100}%` }} />
            </div>
            Loading {loaded} of {slices} slices…
          </div>
        )}
        <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11.5px] text-white/85 tabular capitalize">{plane} · {counter.i + 1} / {counter.of}</span>
        <span className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white/70">↕ scroll · ↔ contrast</span>
      </div>
      <input type="range" min={0} max={Math.max(0, counter.of - 1)} value={counter.i} onChange={(e) => { pos.current[plane] = Number(e.target.value); draw(); }} aria-label="Slice" className="w-full accent-[var(--accent)]" />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Window">
        {windows?.length ? (["", ...windows] as string[]).map((w) => (
          <button key={w || "shown"} type="button" role="radio" aria-checked={folder === w} onClick={() => { tap(); setFolder(w); setWindow(255, 128); }} className={cn("rounded-full border px-3 py-1 text-[12px] font-medium", folder === w ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2", full && folder !== w && "border-white/20 text-white/70")}>
            {w === "" ? "As shown" : w === "soft" ? "Soft tissue" : w === "lung" ? "Lung window" : w === "bone" ? "Bone window" : w}
          </button>
        )) : PRESETS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} onClick={() => { tap(); setPreset(p.id); setWindow(p.w, p.l); }} className={cn("rounded-full border px-3 py-1 text-[12px] font-medium", preset === p.id ? "border-accent-line bg-accent-soft text-accent-text" : "border-line text-fg-2", full && preset !== p.id && "border-white/20 text-white/70")}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
