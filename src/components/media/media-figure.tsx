"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { MediaAsset } from "@/engine/types";
import { cn } from "@/lib/cn";

import { DermPhoto } from "./derm";
import { EcgTrace } from "./ecg";
import { MediaViewer, useMediaViewer } from "./media-viewer";
import { RadiographImage } from "./radiograph";

function Render({ media }: { media: MediaAsset }) {
  if (media.src) {
    // Real, licensed imagery takes precedence over procedural specs.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.src} alt={media.alt} className="block h-auto w-full" loading="lazy" />;
  }
  const spec = media.spec;
  if (!spec) return null;
  if (spec.kind === "ecg") return <EcgTrace spec={spec} className="block h-auto w-full" />;
  if (spec.kind === "derm") return <DermPhoto spec={spec} className="block aspect-[4/3] h-auto w-full" />;
  return <RadiographImage spec={spec} className="block aspect-square h-auto w-full bg-black" />;
}

/** Clinical media with acquisition caption; opens the full-screen viewer. */
export function MediaFigure({ media, className, compact = false, viewerKey, title }: { media: MediaAsset; className?: string; compact?: boolean; viewerKey?: string; title?: string }) {
  const viewer = useMediaViewer();
  const [local, setLocal] = useState(false);
  const square = media.spec && media.spec.kind !== "ecg" && media.spec.kind !== "derm";
  const open = () => {
    if (viewer) viewer.open(viewerKey ?? media, title);
    else setLocal(true);
  };
  return (
    <figure className={cn("overflow-hidden rounded-lg border border-line bg-surface", className)}>
      <button type="button" onClick={open} className={cn("group relative block w-full cursor-zoom-in overflow-hidden text-left", square && !compact && "mx-auto max-w-[420px]")} aria-label={`Open image full size: ${media.alt}`}>
        <Render media={media} />
        <span className="pointer-events-none absolute top-2 right-2 flex h-8 items-center gap-1.5 rounded-full bg-black/55 px-2.5 text-[11.5px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Icon name="maximize" size={13} /> Open
        </span>
      </button>
      {media.caption && !compact && (
        <figcaption className="flex items-center justify-between gap-3 border-t border-line-2 px-3 py-2 text-[11.5px] text-fg-2">
          <span className="tabular">{media.caption}</span>
          <button type="button" onClick={open} className="flex items-center gap-1 text-fg-3 hover:text-fg">
            <Icon name="zoom-in" size={13} /> Zoom
          </button>
        </figcaption>
      )}
      {!viewer && <MediaViewer items={[{ key: "local", media, title: title ?? media.caption ?? "Image" }]} index={local ? 0 : null} onIndex={() => undefined} onClose={() => setLocal(false)} />}
    </figure>
  );
}
