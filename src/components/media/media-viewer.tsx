"use client";

/**
 * Full-screen viewer for clinical images: zoom (buttons, wheel, double-click,
 * pinch), pan by dragging, and ← → through every image in the case.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { MediaAsset } from "@/engine/types";
import { cn } from "@/lib/cn";

import { DermPhoto } from "./derm";
import { EcgTrace } from "./ecg";
import { RadiographImage } from "./radiograph";

export interface ViewerItem {
  key: string;
  media: MediaAsset;
  title: string;
}

interface ViewerApi {
  /** Opens a case image by key, or any single image. */
  open: (target: string | MediaAsset, title?: string) => void;
}

const ViewerContext = createContext<ViewerApi | null>(null);
export const useMediaViewer = () => useContext(ViewerContext);

const MIN = 1;
const MAX = 6;
const clamp = (z: number) => Math.max(MIN, Math.min(MAX, z));

function LargeMedia({ media }: { media: MediaAsset }) {
  if (media.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.src} alt={media.alt} draggable={false} className="block max-h-[78dvh] max-w-[92vw] object-contain" />;
  }
  const spec = media.spec;
  if (!spec) return null;
  if (spec.kind === "ecg") return <EcgTrace spec={spec} className="block h-auto w-[min(1400px,94vw)] rounded-md" />;
  if (spec.kind === "derm") return <DermPhoto spec={spec} className="block aspect-[4/3] h-auto w-[min(1000px,92vw,104dvh)] rounded-md" />;
  return <RadiographImage spec={spec} className="block aspect-square h-auto w-[min(78dvh,92vw)] rounded-md bg-black" />;
}

export function MediaViewer({ items, index, onIndex, onClose }: { items: ViewerItem[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const item = index !== null ? items[index] : undefined;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (item && !el.open) el.showModal();
    if (!item && el.open) el.close();
  }, [item]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  /** Zoom to `next`, keeping the point under (cx, cy) — stage-centre coordinates — still. */
  const zoomTo = useCallback((next: number, cx = 0, cy = 0) => {
    setZoom((z) => {
      const nz = clamp(next);
      setPan((p) => (nz === 1 ? { x: 0, y: 0 } : { x: cx - ((cx - p.x) * nz) / z, y: cy - ((cy - p.y) * nz) / z }));
      return nz;
    });
  }, []);

  const centreOf = (clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) };
  };

  const step = useCallback(
    (d: number) => {
      if (index === null || items.length < 2) return;
      onIndex((index + d + items.length) % items.length);
    },
    [index, items.length, onIndex],
  );

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") zoomTo(zoom * 1.4);
      else if (e.key === "-" || e.key === "_") zoomTo(zoom / 1.4);
      else if (e.key === "0") zoomTo(1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, zoom, zoomTo, step]);

  return (
    <dialog
      ref={ref}
      aria-label={item ? `Image viewer: ${item.title}` : "Image viewer"}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#05070d] p-0 text-white backdrop:bg-black open:flex open:flex-col"
    >
      {item && (
        <>
          <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold">{item.title}</h2>
              <p className="truncate text-[12px] text-white/50">
                {item.media.caption}
                {items.length > 1 && <span className="ml-2 tabular">· {index! + 1} of {items.length}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-1">
              <IconButton label="Zoom out" size="sm" onClick={() => zoomTo(zoom / 1.4)} className="rounded-full text-white/80 hover:bg-white/10 hover:text-white">
                <Icon name="zoom-out" size={16} />
              </IconButton>
              <button type="button" onClick={() => zoomTo(1)} className="w-12 text-center text-[12px] text-white/70 tabular hover:text-white" aria-label="Reset zoom">
                {Math.round(zoom * 100)}%
              </button>
              <IconButton label="Zoom in" size="sm" onClick={() => zoomTo(zoom * 1.4)} className="rounded-full text-white/80 hover:bg-white/10 hover:text-white">
                <Icon name="zoom-in" size={16} />
              </IconButton>
            </div>
            <IconButton label="Close viewer" size="sm" onClick={onClose} className="rounded-full text-white/80 hover:bg-white/10 hover:text-white">
              <Icon name="x" size={18} />
            </IconButton>
          </header>

          <div
            ref={stage}
            className={cn("relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none", zoom > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in")}
            onWheel={(e) => {
              const c = centreOf(e.clientX, e.clientY);
              zoomTo(zoom * Math.exp(-e.deltaY * 0.0022), c.x, c.y);
            }}
            onDoubleClick={(e) => {
              const c = centreOf(e.clientX, e.clientY);
              zoomTo(zoom > 1.2 ? 1 : 2.5, c.x, c.y);
            }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()];
                pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom };
                drag.current = null;
              } else {
                drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
                setDragging(true);
              }
            }}
            onPointerMove={(e) => {
              if (!pointers.current.has(e.pointerId)) return;
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (pinch.current && pointers.current.size === 2) {
                const [a, b] = [...pointers.current.values()];
                const mid = centreOf((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
                zoomTo((pinch.current.zoom * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / pinch.current.dist, mid.x, mid.y);
              } else if (drag.current && zoom > 1) {
                setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y });
              }
            }}
            onPointerUp={(e) => {
              pointers.current.delete(e.pointerId);
              if (pointers.current.size < 2) pinch.current = null;
              if (pointers.current.size === 0) {
                drag.current = null;
                setDragging(false);
              }
            }}
            onPointerCancel={(e) => {
              pointers.current.delete(e.pointerId);
              pinch.current = null;
              drag.current = null;
              setDragging(false);
            }}
          >
            <div
              className={cn("will-change-transform", !dragging && !pinch.current && "transition-transform duration-150 ease-out")}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <LargeMedia media={item.media} />
            </div>

            {items.length > 1 && (
              <>
                <IconButton label="Previous image" onClick={() => step(-1)} className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 sm:left-5">
                  <Icon name="chevron-left" size={20} />
                </IconButton>
                <IconButton label="Next image" onClick={() => step(1)} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 sm:right-5">
                  <Icon name="chevron-right" size={20} />
                </IconButton>
              </>
            )}
          </div>

          <footer className="px-4 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] text-center text-[12px] text-white/45 sm:px-6">
            Scroll or pinch to zoom · drag to move · double-click to zoom in{items.length > 1 ? " · ← → for other images" : ""}
          </footer>
        </>
      )}
    </dialog>
  );
}

/** Makes every image in the case open in one viewer, in order. */
export function MediaViewerProvider({ items, children }: { items: ViewerItem[]; children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const [single, setSingle] = useState<ViewerItem | null>(null);
  const api = useMemo<ViewerApi>(
    () => ({
      open: (target, title) => {
        if (typeof target === "string") {
          const i = items.findIndex((x) => x.key === target);
          if (i >= 0) {
            setSingle(null);
            setIndex(i);
          }
          return;
        }
        setSingle({ key: "single", media: target, title: title ?? target.caption ?? "Image" });
        setIndex(0);
      },
    }),
    [items],
  );
  const close = useCallback(() => {
    setIndex(null);
    setSingle(null);
  }, []);
  return (
    <ViewerContext.Provider value={api}>
      {children}
      <MediaViewer items={single ? [single] : items} index={index} onIndex={setIndex} onClose={close} />
    </ViewerContext.Provider>
  );
}
