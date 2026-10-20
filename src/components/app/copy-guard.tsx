"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Pages where copying is useful and gives nothing away: your own things, the community, the legal pages. */
const COPYABLE = /^\/(community|profile|suggestions|admin|support|pricing|terms|privacy|disclaimer|refund-policy|shipping-policy|contact|about|invite|progress|achievements)(\/|$)/;

/** No right-click "Save image" on pictures, scans or tracings; no dragging them out. Text fields are left alone. */
export function CopyGuard() {
  const path = usePathname();
  useEffect(() => {
    document.body.dataset.copy = COPYABLE.test(path) ? "on" : "off";
  }, [path]);
  useEffect(() => {
    const media = (t: EventTarget | null) => t instanceof Element && !!t.closest("img, canvas, video, svg, figure");
    const onMenu = (e: MouseEvent) => media(e.target) && e.preventDefault();
    const onDrag = (e: DragEvent) => media(e.target) && e.preventDefault();
    document.addEventListener("contextmenu", onMenu);
    document.addEventListener("dragstart", onDrag);
    return () => {
      document.removeEventListener("contextmenu", onMenu);
      document.removeEventListener("dragstart", onDrag);
    };
  }, []);
  return null;
}
